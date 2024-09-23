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
    const { accessToken, createdAt, expiresIn } = this.apiConfig;
    const isTokenExpired = Date.now() / 1000 > createdAt + expiresIn - 60;
    if (isTokenExpired) {
      const apiConfig = await this.refreshAccessToken();
      return {
        headers: {
          Authorization: `Bearer ${apiConfig.accessToken}`,
        },
      };
    }
    return {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  private async refreshAccessToken() {
    const res = await this.requestNewAccessToken();
    const data = res.data;

    const updatedDoc = await prisma.integrationAccounts.update({
      where: {
        userId_provider: {
          userId: this.apiConfig.userId,
          provider: IntegrationProvider.CALENDLY,
        },
      },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        createdAt: data.created_at,
      },
    });

    this.apiConfig.accessToken = updatedDoc.accessToken;
    this.apiConfig.refreshToken = updatedDoc.refreshToken;
    this.apiConfig.createdAt = updatedDoc.createdAt;
    this.apiConfig.expiresIn = updatedDoc.expiresIn;
    return this.apiConfig;
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
      const res = await step.run(`Fetch Event Types from Calendly Page ${page}`, async () => {
        try {
          return (await this.request.get(url, await this.requestConfiguration())).data;
        } catch (e) {
          if (e.response.status === 429) {
            throw new RetryAfterError(
              `RetryError - getUserEventTypes: ${e instanceof Error ? e.message : e}`,
              waitTime
            );
          }
          throw new NonRetriableError(
            `NonRetriableError - getUserEventTypes: ${e instanceof Error ? e.message : e}`
          );
        }
      });

      const data = res as CalendlyEventTypeSuccessResponse;
      let allEventTypes: CalendlyEventType[] = [...data.collection];
      let next_page = data.pagination.next_page;
      while (next_page) {
        page++;
        const res = await step.run(`Fetch Event Types from Calendly Page ${page}`, async () => {
          try {
            return (await this.request.get(next_page, await this.requestConfiguration())).data;
          } catch (e) {
            if (e.response.status === 429) {
              throw new RetryAfterError(
                `RetryError - getUserEventTypes: ${e instanceof Error ? e.message : e}`,
                waitTime
              );
            }
            throw new NonRetriableError(
              `NonRetriableError - getUserEventTypes: ${e instanceof Error ? e.message : e}`
            );
          }
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
      const res = await step.run(`Fetch Bookings from Calendly Page ${page}`, async () => {
        try {
          return (await this.request.get(url, await this.requestConfiguration())).data;
        } catch (e) {
          if (e.response.status === 429) {
            throw new RetryAfterError(
              `RetryError - getUserScheduledEvents: ${e instanceof Error ? e.message : e}`,
              waitTime
            );
          }
          //  else if (e.response.status === 401) {
          //   //refresh access token
          //   await this.refreshAccessToken(); //updates the tokens in `await this.requestConfiguration()`.
          //   throw new Error(`Token expired ,so retrying with fresh token`);
          // }
          throw new NonRetriableError(
            `NonRetriableError - getUserScheduledEvents: ${e instanceof Error ? e.message : e}`
          );
        }
      });

      const data = res as CalendlyScheduledEventSuccessResponse;
      let allScheduledEvents: CalendlyScheduledEvent[] = [...data.collection];
      let next_page: string | null = data?.pagination?.next_page ?? null;

      while (next_page) {
        page++;
        const res = await step.run(`Fetch Bookings from Calendly Page ${page}`, async () => {
          try {
            return (await this.request.get(next_page, await this.requestConfiguration())).data;
          } catch (e) {
            if (e.response.status === 429) {
              throw new RetryAfterError(
                `RetryError - getUserScheduledEvents: ${e instanceof Error ? e.message : e}`,
                waitTime
              );
            }
            throw new NonRetriableError(
              `NonRetriableError - getUserEventTypes: ${e instanceof Error ? e.message : e}`
            );
          }
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
    uuid,
    step,
  }: {
    uuid: string;
    step: ReturnType<typeof createStepTools>;
  }): Promise<CalendlyScheduledEventInvitee[]> => {
    try {
      const count = 99;
      const queryParams = [`count=${count}`].join("&");
      // if (pageToken) queryParams += `&page_token=${pageToken}`;

      const url = `/scheduled_events/${uuid}/invitees?${queryParams}`;
      let page = 1;
      const res = await step.run(`Fetch booking - ${uuid} invitees page - ${page}`, async () => {
        try {
          return (await this.request.get(url, await this.requestConfiguration())).data;
        } catch (e) {
          if (e.response.status === 429) {
            throw new RetryAfterError(
              `RetryError - getUserScheduledEventInvitees: ${e instanceof Error ? e.message : e}`,
              waitTime
            );
          }
          throw new NonRetriableError(
            `NonRetriableError - getUserScheduledEventInvitees: ${e instanceof Error ? e.message : e}`
          );
        }
      });

      // const res = await this.request.get(url, await this.requestConfiguration());

      const data = res as CalendlyScheduledEventInviteeSuccessResponse;
      let allScheduledEventInvitees: CalendlyScheduledEventInvitee[] = [...data.collection];
      let next_page = data?.pagination?.next_page;

      while (next_page) {
        page++;
        const res = await step.run(`Fetch booking - ${uuid} invitees page - ${page}`, async () => {
          try {
            return (await this.request.get(next_page, await this.requestConfiguration())).data;
          } catch (e) {
            if (e.response.status === 429) {
              throw new RetryAfterError(
                `RetryError - getUserEventTypes: ${e instanceof Error ? e.message : e}`,
                waitTime
              );
            }
            throw new NonRetriableError(
              `NonRetriableError - getUserEventTypes: ${e instanceof Error ? e.message : e}`
            );
          }
        });
        // const res = await this.request.get(next_page, await this.requestConfiguration());

        const newData = res as CalendlyScheduledEventInviteeSuccessResponse;
        allScheduledEventInvitees = [...allScheduledEventInvitees, ...newData.collection];
        next_page = newData.pagination.next_page;
      }

      return allScheduledEventInvitees;
    } catch (error: unknown) {
      console.error("Internal server error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
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
      const res = await step.run(`Fetch Availability Schedules from Calendly `, async () => {
        try {
          return (await this.request.get(url, await this.requestConfiguration())).data;
        } catch (e) {
          if (e.response.status === 429) {
            throw new RetryAfterError(
              `RetryError - getUserAvailabilitySchedules: ${e instanceof Error ? e.message : e}`,
              waitTime
            );
          }
          throw new NonRetriableError(
            `NonRetriableError - getUserAvailabilitySchedules: ${e instanceof Error ? e.message : e}`
          );
        }
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

  requestNewAccessToken = () => {
    const { oauthUrl, clientID, clientSecret, refreshToken } = this.apiConfig;

    return axios.post(`${oauthUrl}/token`, {
      client_id: clientID,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  };
  _isRequestResponseOk(response: AxiosResponse) {
    return response.status >= 200 && response.status < 300;
  }
}
