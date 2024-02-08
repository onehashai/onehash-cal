// calendly-service.ts
import type { AxiosInstance, AxiosResponse } from "axios";
import axios from "axios";

import type {
  UserSuccessResponse,
  UserErrorResponse,
  CalendlyEventType,
  CalendlyEventTypeErrorResponse,
  CalendlyEventTypeSuccessResponse,
  CalendlyScheduledEvent,
  CalendlyScheduledEventSuccessResponse,
  CalendlyScheduledEventErrorResponse,
  CalendlyScheduledEventInvitee,
  CalendlyScheduledEventInviteeSuccessResponse,
  CalendlyScheduledEventInviteeErrorResponse,
  CalendlyUserAvailabilitySchedulesErrorResponse,
  CalendlyUserAvailabilitySchedulesSuccessResponse,
  CalendlyUserAvailabilitySchedules,
} from "../types";

export default class CalendlyAPIService {
  private apiConfig: {
    accessToken: string;
    refreshToken: string;
    clientSecret: string;
    clientID: string;
    oauthUrl: string;
  };
  private request: AxiosInstance;

  constructor(apiConfig: {
    accessToken: string;
    refreshToken: string;
    clientSecret: string;
    clientID: string;
    oauthUrl: string;
  }) {
    const { accessToken, refreshToken, clientSecret, clientID, oauthUrl } = apiConfig;
    if (!accessToken || !refreshToken || !clientSecret || !clientID || !oauthUrl)
      throw new Error("Missing Calendly API configuration");
    this.apiConfig = {
      accessToken,
      refreshToken,
      clientSecret,
      clientID,
      oauthUrl,
    };
    this.request = axios.create({
      baseURL: "https://api.calendly.com", // Adjust the base URL if needed
    });
  }

  // Rest of the CalendlyService code remains unchanged
  // ...

  requestConfiguration() {
    const { accessToken } = this.apiConfig;
    return {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  /**
   * Fetches  Calendly's user info via "/users/me" endpoint using current user's access_token.
   * @returns {Promise<UserSuccessResponse | UserErrorResponse>} An object containing the access token .
   * @throws {Error} If there is an error fetching the access token or if the response is not successful.
   */
  getUserInfo = async (): Promise<UserSuccessResponse | UserErrorResponse> => {
    const res = await this.request.get("/users/me", this.requestConfiguration());
    if (!this._isRequestResponseOk(res)) {
      const errorData: UserErrorResponse = res.data;
      console.error("Error fetching user info:", errorData.title, errorData.message);
    }
    const data: UserSuccessResponse = res.data;
    return data;
  };

  getUserEventTypes = async (userUri: string, active = true): Promise<CalendlyEventType[]> => {
    let queryParams = `user=${userUri}`;
    if (active) queryParams += `&active=${active}`;
    const url = `/event_types?${queryParams}`;
    const res = await this.request.get(url, this.requestConfiguration());
    if (this._isRequestResponseOk(res)) {
      const data = res.data as CalendlyEventTypeSuccessResponse;
      let allEventTypes: CalendlyEventType[] = [...data.collection];
      let next_page = data.pagination.next_page;
      while (next_page) {
        try {
          const res = await this.request.get(next_page, this.requestConfiguration());
          if (!this._isRequestResponseOk(res)) {
            const data = res.data as CalendlyEventTypeErrorResponse;
            console.error("Error fetching user event types:", data.message);
            break;
          }
          // Add the current collection to the list
          allEventTypes = [...allEventTypes, ...data.collection];
          // Update the API URL for the next page
          next_page = data.pagination.next_page;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          console.error("Error fetching data:", error.message);
          break;
        }
      }
      return allEventTypes;
    } else {
      const data = res.data as CalendlyEventTypeErrorResponse;
      console.error("Error fetching user event types:", data.message);
      return [];
    }
  };

  getUserEventType = async (uuid: string) => {
    const { data } = await this.request.get(`/event_types/${uuid}`, this.requestConfiguration());

    return data;
  };

  getUserScheduledEvents = async ({
    userUri,
    count,
    pageToken,
    status,
    maxStartTime,
    minStartTime,
  }: {
    userUri: string;
    count?: number;
    pageToken?: string;
    status?: string;
    maxStartTime?: string;
    minStartTime?: string;
  }): Promise<CalendlyScheduledEvent[]> => {
    let queryParams = [`user=${userUri}`, `count=${count || 10}`, `sort=start_time:asc`].join("&");

    if (pageToken) queryParams += `&page_token=${pageToken}`;
    if (status) queryParams += `&status=${status}`;
    if (maxStartTime) queryParams += `&max_start_time=${maxStartTime}`;
    if (minStartTime) queryParams += `&min_start_time=${minStartTime}`;

    const url = `/scheduled_events?${queryParams}`;
    const res = await this.request.get(url, this.requestConfiguration());
    if (this._isRequestResponseOk(res)) {
      const data = res.data as CalendlyScheduledEventSuccessResponse;
      let allScheduledEvents: CalendlyScheduledEvent[] = [...data.collection];
      let next_page = data?.pagination?.next_page;
      while (next_page) {
        try {
          const res = await this.request.get(next_page, this.requestConfiguration());
          if (!this._isRequestResponseOk(res)) {
            const data = res.data as CalendlyScheduledEventErrorResponse;
            console.error("Error fetching user event types:", data.message);
            break;
          }
          // Add the current collection to the list
          allScheduledEvents = [...allScheduledEvents, ...data.collection];
          // Update the API URL for the next page
          next_page = data.pagination.next_page;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          console.error("Error fetching data:", error.message);
          break;
        }
      }
      return allScheduledEvents;
    } else {
      const data = res.data as CalendlyEventTypeErrorResponse;
      console.error("Error fetching user event types:", data.message);
      return [];
    }
  };

  getUserScheduledEvent = async (uuid: string) => {
    const { data } = await this.request.get(`/scheduled_events/${uuid}`, this.requestConfiguration());

    return data;
  };

  getUserScheduledEventInvitees = async (
    uuid: string,
    count = 20,
    pageToken?: string
  ): Promise<CalendlyScheduledEventInvitee[]> => {
    let queryParams = [`count=${count}`].join("&");

    if (pageToken) queryParams += `&page_token=${pageToken}`;

    const url = `/scheduled_events/${uuid}/invitees?${queryParams}`;
    const res = await this.request.get(url, this.requestConfiguration());
    if (this._isRequestResponseOk(res)) {
      const data = res.data as CalendlyScheduledEventInviteeSuccessResponse;
      let allScheduledEventInvitees: CalendlyScheduledEventInvitee[] = [...data.collection];
      let next_page = data?.pagination?.next_page;
      while (next_page) {
        try {
          const res = await this.request.get(next_page, this.requestConfiguration());
          if (!this._isRequestResponseOk(res)) {
            const data = res.data as CalendlyScheduledEventInviteeErrorResponse;
            console.error("Error fetching user event types:", data.message);
            break;
          }
          // Add the current collection to the list
          allScheduledEventInvitees = [...allScheduledEventInvitees, ...data.collection];
          // Update the API URL for the next page
          next_page = data.pagination.next_page;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          console.error("Error fetching data:", error.message);
          break;
        }
      }
      return allScheduledEventInvitees;
    } else {
      const data = res.data as CalendlyScheduledEventInviteeErrorResponse;
      console.error("Error fetching user event types:", data.message);
      return [];
    }
  };

  getUserEventTypeAvailTimes = async (eventUri: string, startTime: string, endTime: string) => {
    const queryParams = [`start_time=${startTime}`, `end_time=${endTime}`, `event_type=${eventUri}`].join(
      "&"
    );

    const url = `/event_type_available_times?${queryParams}`;

    const { data } = await this.request.get(url, this.requestConfiguration());

    return data;
  };

  getUserBusyTimes = async (userUri: string, startTime: string, endTime: string) => {
    const queryParams = [`user=${userUri}`, `start_time=${startTime}`, `end_time=${endTime}`].join("&");

    const url = `/user_busy_times?${queryParams}`;

    const { data } = await this.request.get(url, this.requestConfiguration());

    return data;
  };

  getUserAvailabilitySchedules = async (userUri: string): Promise<CalendlyUserAvailabilitySchedules[]> => {
    try {
      const url = `/user_availability_schedules?user=${userUri}`;
      const res = await this.request.get(url, this.requestConfiguration());
      if (!this._isRequestResponseOk(res)) {
        const data = res.data as CalendlyUserAvailabilitySchedulesErrorResponse;
        console.error("Error fetching user availability schedules:", data.message);
        throw new Error(data.message);
      }
      const data = res.data as CalendlyUserAvailabilitySchedulesSuccessResponse;
      return data.collection;
    } catch (e) {
      e instanceof Error
        ? console.error("Internal server error:", e.message)
        : console.error("Internal server error:", String(e));
      throw e;
    }
  };

  getUser = async (userUri: string) => {
    const url = `/users/${userUri}`;

    const res = await this.request.get(url, this.requestConfiguration());
    if (this._isRequestResponseOk(res)) {
      const data = res.data as UserSuccessResponse;
      return data;
    } else {
      const data = res.data as UserErrorResponse;
      console.error("Error fetching user info:", data.message);
    }
  };

  markAsNoShow = async (uri: string) => {
    const { data } = await this.request.post(
      "/invitee_no_shows",
      {
        invitee: uri,
      },
      this.requestConfiguration()
    );

    return data;
  };

  undoNoShow = async (inviteeUuid: string) => {
    await this.request.delete(`/invitee_no_shows/${inviteeUuid}`, this.requestConfiguration());
  };

  cancelEvent = async (uuid: string, reason: string) => {
    const { data } = await this.request.post(
      `/scheduled_events/${uuid}/cancellation`,
      {
        reason: reason,
      },
      this.requestConfiguration()
    );

    return data;
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
