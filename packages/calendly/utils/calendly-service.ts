// calendly-service.ts
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import axios from "axios";

import type { UserSuccessResponse, UserErrorResponse } from "./calendly";

export default class CalendlyAPIService {
  private apiConfig: {
    accessToken: string;
    refreshToken: string;
    clientSecret: string;
    clientID: string;
    oauthUrl: string;
  };
  private request: AxiosInstance;
  private requestInterceptor: number;
  updateTokensinDBCallback?: (newAccessToken: string, newRefreshToken: string) => Promise<void>;

  constructor(
    apiConfig: {
      accessToken: string;
      refreshToken: string;
      clientSecret: string;
      clientID: string;
      oauthUrl: string;
    },
    updateTokensinDBCallback?: (newAccessToken: string, newRefreshToken: string) => Promise<void>
  ) {
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
    this.updateTokensinDBCallback = updateTokensinDBCallback;
    this.request = axios.create({
      baseURL: "https://api.calendly.com", // Adjust the base URL if needed
    });

    this.requestInterceptor = this.request.interceptors.response.use((res) => res, this._onCalendlyError);
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

  getUserEventTypes = async (userUri: string) => {
    const { data } = await this.request.get(`/event_types?user=${userUri}`, this.requestConfiguration());

    return data;
  };

  getUserEventType = async (uuid: string) => {
    const { data } = await this.request.get(`/event_types/${uuid}`, this.requestConfiguration());

    return data;
  };

  getUserScheduledEvents = async (
    userUri: string,
    count: number,
    pageToken?: string,
    status?: string,
    maxStartTime?: string,
    minStartTime?: string
  ) => {
    let queryParams = [`user=${userUri}`, `count=${count || 10}`, `sort=start_time:asc`].join("&");

    if (pageToken) queryParams += `&page_token=${pageToken}`;
    if (status) queryParams += `&status=${status}`;
    if (maxStartTime) queryParams += `&max_start_time=${maxStartTime}`;
    if (minStartTime) queryParams += `&min_start_time=${minStartTime}`;

    const url = `/scheduled_events?${queryParams}`;

    const { data } = await this.request.get(url, this.requestConfiguration());

    return data;
  };

  getUserScheduledEvent = async (uuid: string) => {
    const { data } = await this.request.get(`/scheduled_events/${uuid}`, this.requestConfiguration());

    return data;
  };

  getUserScheduledEventInvitees = async (uuid: string, count: number, pageToken?: string) => {
    let queryParams = [`count=${count || 10}`].join("&");

    if (pageToken) queryParams += `&page_token=${pageToken}`;

    const url = `/scheduled_events/${uuid}/invitees?${queryParams}`;

    const { data } = await this.request.get(url, this.requestConfiguration());

    return data;
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

  getUserAvailabilitySchedules = async (userUri: string) => {
    const url = `/user_availability_schedules?user=${userUri}`;

    const { data } = await this.request.get(url, this.requestConfiguration());

    return data;
  };

  getUser = async (userUri: string) => {
    const url = `/users/${userUri}`;

    const { data } = await this.request.get(url, this.requestConfiguration());

    return data;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _onCalendlyError = async (error: { response: { status: number; config: AxiosRequestConfig<any> } }) => {
    if (error.response.status !== 401) return Promise.reject(error);

    this.request.interceptors.response.eject(this.requestInterceptor);

    try {
      const response = await this.requestNewAccessToken();
      const { access_token, refresh_token } = response.data;

      this.apiConfig = {
        ...this.apiConfig,
        accessToken: access_token,
        refreshToken: refresh_token,
      };

      if (!error.response.config.headers) error.response.config.headers = {};

      error.response.config.headers.Authorization = `Bearer ${access_token}`;

      // Call the callback function to update tokens in the database
      if (this.updateTokensinDBCallback) {
        await this.updateTokensinDBCallback(access_token, refresh_token);
      }

      // retry original request with new access token
      return this.request(error.response.config);
    } catch (e) {
      return Promise.reject(e);
    }
  };

  _isRequestResponseOk(response: AxiosResponse) {
    return response.status >= 200 && response.status < 300;
  }
}
