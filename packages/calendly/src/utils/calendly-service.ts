import type { AxiosInstance, AxiosResponse } from "axios";
import axios from "axios";
import { NonRetriableError, RetryAfterError } from "inngest";
import type { createStepTools } from "inngest/components/InngestStepTools";

import prisma from "@calcom/prisma";
import { IntegrationProvider } from "@calcom/prisma/enums";

import type {
  UserSuccessResponse,
  UserErrorResponse,
  CalendlyEventType,
  CalendlyEventTypeSuccessResponse,
  CalendlyScheduledEvent,
  CalendlyScheduledEventSuccessResponse,
  CalendlyScheduledEventInvitee,
  CalendlyScheduledEventInviteeSuccessResponse,
  CalendlyUserAvailabilitySchedulesSuccessResponse,
  CalendlyUserAvailabilitySchedules,
} from "../types";

const waitTime = 65000; //1min 5 seconds

export default class CalendlyAPIService {
  private apiConfig: {
    accessToken: string;
    refreshToken: string;
    clientSecret: string;
    clientID: string;
    oauthUrl: string;
    userId: number;
    createdAt: number;
    expiresIn: number;
  };
  private request: AxiosInstance;

  constructor(apiConfig: {
    accessToken: string;
    refreshToken: string;
    clientSecret: string;
    clientID: string;
    oauthUrl: string;
    userId: number;
    createdAt: number;
    expiresIn: number;
  }) {
    const { accessToken, refreshToken, clientSecret, clientID, oauthUrl, userId } = apiConfig;
    if (!accessToken || !refreshToken || !clientSecret || !clientID || !oauthUrl || !userId)
      throw new Error("Missing Calendly API configuration");
    this.apiConfig = {
      accessToken,
      refreshToken,
      clientSecret,
      clientID,
      oauthUrl,
      userId,
      createdAt: apiConfig.createdAt,
      expiresIn: apiConfig.expiresIn,
    };
    this.request = axios.create({
      baseURL: "https://api.calendly.com",
    });
  }

  async requestConfiguration() {
    // const { accessToken, createdAt, expiresIn } = this.apiConfig;
    const config = await this.getConfigFromDB();
    const { accessToken, createdAt, expiresIn } = config;
    const isTokenExpired = Date.now() / 1000 > createdAt + expiresIn - 60;
    if (isTokenExpired) {
      const updatedConfig = await this.refreshAccessToken(config.refreshToken);
      return {
        headers: {
          Authorization: `Bearer ${updatedConfig.accessToken}`,
        },
      };
    }
    return {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  private async refreshAccessToken(refreshToken) {
    const data = await this.requestNewAccessToken(refreshToken);

    // const updatedDoc = await prisma.integrationAccounts.update({
    //   where: {
    //     userId_provider: {
    //       userId: this.apiConfig.userId,
    //       provider: IntegrationProvider.CALENDLY,
    //     },
    //   },
    //   data: {
    //     accessToken: data.access_token,
    //     refreshToken: data.refresh_token,
    //     expiresIn: data.expires_in,
    //     createdAt: data.created_at,
    //   },
    // });

    this.apiConfig = {
      ...this.apiConfig,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      createdAt: data.created_at,
      expiresIn: data.expires_in,
    };

    this.apiConfig = {
      ...this.apiConfig,
      accessToken: updatedDoc.accessToken,
      refreshToken: data.refresh_token,
      createdAt: data.created_at,
      expiresIn: data.expires_in,
    };
    return updatedDoc;
  }

  private async fetchDataWithRetry({
    title,
    url,
    fnName,
    step,
  }: {
    title: string;
    url: string;
    fnName: string;
    step: ReturnType<typeof createStepTools>;
  }) {
    const res = await step.run(title, async () => {
      try {
        return (await this.request.get(url, await this.requestConfiguration())).data;
      } catch (e) {
        if (e.response && (e.response.status === 429 || e.response.status === 520)) {
          throw new RetryAfterError(
            `RetryError - ${fnName}: ${e instanceof Error ? e.message : e}`,
            waitTime
          );
        }
        throw new NonRetriableError(`NonRetriableError - ${fnName}: ${e instanceof Error ? e.message : e}`);
      }
    });

    return res;
  }

  /**
   * Fetches  Calendly's user info via "/users/me" endpoint using current user's access_token.
   * @returns {Promise<UserSuccessResponse | UserErrorResponse>} An object containing the access token .
   * @throws {Error} If there is an error fetching the access token or if the response is not successful.
   */
  getUserInfo = async (): Promise<UserSuccessResponse | UserErrorResponse> => {
    try {
      const res = await this.request.get("/users/me", await this.requestConfiguration());
      if (!this._isRequestResponseOk(res)) {
        const errorData: UserErrorResponse = res.data;
        console.error("Error fetching user info:", errorData.title, errorData.message);
      }
      const data: UserSuccessResponse = res.data;
      return data;
    } catch (error) {
      console.error("Internal server error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  getUserEventTypes = async ({
    userUri,
    active,
    step,
  }: {
    userUri: string;
    active: boolean;
    step: ReturnType<typeof createStepTools>;
  }): Promise<CalendlyEventType[]> => {
    try {
      const queryParams = `user=${userUri}`;
      // if (active) queryParams += `&active=${active}`;
      const url = `/event_types?${queryParams}`;
      let page = 1;
      const res = await this.fetchDataWithRetry({
        title: `Fetch Event Types from Calendly Page ${page}`,
        url,
        fnName: "getUserEventTypes",
        step,
      });

      const data = res as CalendlyEventTypeSuccessResponse;
      let allEventTypes: CalendlyEventType[] = [...data.collection];
      let next_page = data.pagination.next_page;
      while (next_page) {
        page++;
        const res = await this.fetchDataWithRetry({
          title: `Fetch Event Types from Calendly Page ${page}`,
          url: next_page,
          fnName: "getUserEventTypes",
          step,
        });
        const newData = res as CalendlyEventTypeSuccessResponse;
        allEventTypes = [...allEventTypes, ...newData.collection];
        next_page = newData.pagination.next_page;
      }
      return allEventTypes;
    } catch (e) {
      e instanceof Error
        ? console.error("Internal server error:", e.message)
        : console.error("Internal server error:", String(e));
      throw e;
    }
  };

  getUserEventType = async (uuid: string) => {
    const { data } = await this.request.get(`/event_types/${uuid}`, await this.requestConfiguration());

    return data;
  };

  getUserScheduledEvents = async ({
    userUri,
    count,
    pageToken,
    status,
    maxStartTime,
    minStartTime,
    step,
  }: {
    userUri: string;
    count?: number;
    pageToken?: string;
    status?: string;
    maxStartTime?: string;
    minStartTime?: string;
    step: ReturnType<typeof createStepTools>;
  }): Promise<CalendlyScheduledEvent[]> => {
    try {
      let queryParams = [`user=${userUri}`, `count=${count || 99}`, `sort=start_time:asc`].join("&");
      let page = 1;
      if (pageToken) queryParams += `&page_token=${pageToken}`;
      if (status) queryParams += `&status=${status}`;
      if (maxStartTime) queryParams += `&max_start_time=${maxStartTime}`;
      if (minStartTime) queryParams += `&min_start_time=${minStartTime}`;

      const url = `/scheduled_events?${queryParams}`;
      const res = await this.fetchDataWithRetry({
        title: `Fetch Bookings from Calendly Page ${page}`,
        url,
        fnName: "getUserScheduledEvents",
        step,
      });

      const data = res as CalendlyScheduledEventSuccessResponse;
      let allScheduledEvents: CalendlyScheduledEvent[] = [...data.collection];
      let next_page: string | null = data?.pagination?.next_page ?? null;

      while (next_page) {
        page++;
        const res = await this.fetchDataWithRetry({
          title: `Fetch Bookings from Calendly Page ${page}`,
          url: next_page,
          fnName: "getUserScheduledEvents",
          step,
        });

        const newData = res as CalendlyScheduledEventSuccessResponse;
        allScheduledEvents = [...allScheduledEvents, ...newData.collection];
        next_page = newData.pagination.next_page;
      }

      return allScheduledEvents;
    } catch (error) {
      console.error("Internal server error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  getUserScheduledEvent = async (uuid: string) => {
    try {
      const { data } = await this.request.get(`/scheduled_events/${uuid}`, await this.requestConfiguration());

      return data;
    } catch (error) {
      console.error("Internal server error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
  getUserScheduledEventInvitees = async ({
    uuids,
    batch,
    step,
  }: {
    uuids: string[];
    batch: number;
    step: ReturnType<typeof createStepTools>;
  }): Promise<{ uuid: string; invitees: CalendlyScheduledEventInvitee[] }[]> => {
    const data = await step.run(`Fetch invitees for bookings batch - ${batch}`, async () => {
      const count = 99;
      const queryParams = `count=${count}`;
      const results: { uuid: string; invitees: CalendlyScheduledEventInvitee[] }[] = [];

      for (const uuid of uuids) {
        let allScheduledEventInvitees: CalendlyScheduledEventInvitee[] = [];
        // let next_page: string;

        const fetchPage = async (url: string) => {
          try {
            const response = await this.request.get(url, await this.requestConfiguration());
            return response.data;
          } catch (e) {
            if (e.response) {
              if (e.response.status === 429 || e.response.status === 520) {
                throw new RetryAfterError(
                  `RetryError - getUserScheduledEventInvitees: ${e instanceof Error ? e.message : e}`,
                  waitTime
                );
              }
              if (e.response.status === 400) {
                throw new RetryAfterError(
                  `RetryError - getUserScheduledEventInvitees: Status 400- URL (${url})`,
                  waitTime
                );
              }
            }
            throw new NonRetriableError(
              `NonRetriableError - getUserScheduledEventInvitees: ${e instanceof Error ? e.message : e}`
            );
          }
        };

        // Fetch the first page
        const url = `/scheduled_events/${uuid}/invitees?${queryParams}`;
        const data = (await fetchPage(url)) as CalendlyScheduledEventInviteeSuccessResponse;

        allScheduledEventInvitees = [...data.collection];
        // next_page = data?.pagination?.next_page;

        // // Handle pagination
        // while (next_page) {
        //   const newData = (await fetchPage(next_page)) as CalendlyScheduledEventInviteeSuccessResponse;
        //   allScheduledEventInvitees = [...allScheduledEventInvitees, ...newData.collection];
        //   next_page = newData.pagination.next_page;
        // }

        results.push({ uuid, invitees: allScheduledEventInvitees });
      }
      return results;
    });
    return data as { uuid: string; invitees: CalendlyScheduledEventInvitee[] }[];
  };

  getUserEventTypeAvailTimes = async (eventUri: string, startTime: string, endTime: string) => {
    try {
      const queryParams = [`start_time=${startTime}`, `end_time=${endTime}`, `event_type=${eventUri}`].join(
        "&"
      );

      const url = `/event_type_available_times?${queryParams}`;

      const { data } = await this.request.get(url, await this.requestConfiguration());

      return data;
    } catch (error: unknown) {
      console.error("Internal server error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  getUserBusyTimes = async (userUri: string, startTime: string, endTime: string) => {
    try {
      const queryParams = [`user=${userUri}`, `start_time=${startTime}`, `end_time=${endTime}`].join("&");

      const url = `/user_busy_times?${queryParams}`;

      const { data } = await this.request.get(url, await this.requestConfiguration());

      return data;
    } catch (error: unknown) {
      console.error("Internal server error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  getUserAvailabilitySchedules = async ({
    userUri,
    step,
  }: {
    userUri: string;
    step: ReturnType<typeof createStepTools>;
  }): Promise<CalendlyUserAvailabilitySchedules[]> => {
    try {
      const url = `/user_availability_schedules?user=${userUri}`;
      const res = await this.fetchDataWithRetry({
        title: `Fetch Availability Schedules from Calendly `,
        url,
        fnName: "getUserAvailabilitySchedules",
        step,
      });
      const data = res as CalendlyUserAvailabilitySchedulesSuccessResponse;
      return data.collection;
    } catch (error) {
      console.error("Internal server error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  getUser = async (userUri: string) => {
    try {
      const url = `/users/${userUri}`;

      const res = await this.request.get(url, await this.requestConfiguration());
      if (this._isRequestResponseOk(res)) {
        const data = res.data as UserSuccessResponse;
        return data;
      } else {
        const data = res.data as UserErrorResponse;
        console.error("Error fetching user info:", data.message);
      }
    } catch (error) {
      console.error("Internal server error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  markAsNoShow = async (uri: string) => {
    try {
      const { data } = await this.request.post(
        "/invitee_no_shows",
        {
          invitee: uri,
        },
        await this.requestConfiguration()
      );

      return data;
    } catch (error) {
      console.error("Internal server error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  undoNoShow = async (inviteeUuid: string) => {
    try {
      await this.request.delete(`/invitee_no_shows/${inviteeUuid}`, await this.requestConfiguration());
    } catch (error) {
      console.error("Internal server error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  cancelEvent = async (uuid: string, reason: string) => {
    try {
      const { data } = await this.request.post(
        `/scheduled_events/${uuid}/cancellation`,
        {
          reason: reason,
        },
        await this.requestConfiguration()
      );

      return data;
    } catch (error) {
      console.error("Internal server error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  getConfigFromDB = async () => {
    try {
      const userConfig = await prisma.integrationAccounts.findFirst({
        where: {
          userId: this.apiConfig.userId,
          provider: IntegrationProvider.CALENDLY,
        },
      });
      return userConfig;
    } catch (error) {
      console.error("Internal server error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  requestNewAccessToken = async (refreshToken) => {
    try {
      // const { oauthUrl, clientID, clientSecret, refreshToken } = this.apiConfig;
      const { oauthUrl, clientID, clientSecret } = this.apiConfig;

      const url = `${oauthUrl}/token`;
      const postData = {
        client_id: clientID,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(postData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Failed to refresh token: ${errorData.error_description}`);
      }
      const data = await res.json();
      return data;
    } catch (e) {
      console.error("Error refreshing access token:", e);
      throw e;
    }
  };

  _isRequestResponseOk(response: AxiosResponse) {
    return response.status >= 200 && response.status < 300;
  }
}
