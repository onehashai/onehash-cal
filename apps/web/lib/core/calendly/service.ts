import type { AxiosInstance, AxiosRequestConfig } from "axios";
import axios from "axios";

const { CALENDLY_CLIENT_ID, CALENDLY_CLIENT_SECRET, CALENDLY_AUTHORIZE_URL, CALENDLY_API_BASE_URL } =
  process.env;

class CalendlyService {
  accessToken: string;
  refreshToken: string;
  request: AxiosInstance;
  requestInterceptor: number;
  constructor(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.request = axios.create({
      baseURL: CALENDLY_API_BASE_URL,
    });

    this.requestInterceptor = this.request.interceptors.response.use((res) => res, this._onCalendlyError);
  }

  requestConfiguration() {
    return {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    };
  }

  getUserInfo = async () => {
    const { data } = await this.request.get("/users/me", this.requestConfiguration());

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
    return axios.post(`${CALENDLY_AUTHORIZE_URL}/oauth/token`, {
      client_id: CALENDLY_CLIENT_ID,
      client_secret: CALENDLY_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
    });
  };

  _onCalendlyError = async (error: { response: { status: number; config: AxiosRequestConfig<any> } }) => {
    if (error.response.status !== 401) return Promise.reject(error);

    this.request.interceptors.response.eject(this.requestInterceptor);

    try {
      const response = await this.requestNewAccessToken();
      const { access_token, refresh_token } = response.data;

      //   const user = await User.findByAccessToken(this.accessToken);

      //   await User.update(user.id, {
      //     accessToken: access_token,
      //     refreshToken: refresh_token,
      //   });

      this.accessToken = access_token;
      this.refreshToken = refresh_token;

      if (!error.response.config.headers) error.response.config.headers = {};

      error.response.config.headers.Authorization = `Bearer ${access_token}`;

      // retry original request with new access token
      return this.request(error.response.config);
    } catch (e) {
      return Promise.reject(e);
    }
  };
}

module.exports = CalendlyService;
