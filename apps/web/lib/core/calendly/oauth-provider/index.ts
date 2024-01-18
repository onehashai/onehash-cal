const getCalendlyEnvVars = () => {
  const {
    CALENDLY_CLIENT_ID,
    CALENDLY_CLIENT_SECRET,
    CALENDLY_REDIRECT_URI,
    CALENDLY_AUTHORIZE_URL,
    CALENDLY_TOKEN_URL,
  } = process.env;
  if (
    !CALENDLY_CLIENT_ID ||
    !CALENDLY_CLIENT_SECRET ||
    !CALENDLY_REDIRECT_URI ||
    !CALENDLY_AUTHORIZE_URL ||
    !CALENDLY_TOKEN_URL
  ) {
    throw new Error("Missing Calendly env vars");
  }
  return {
    CALENDLY_CLIENT_ID,
    CALENDLY_CLIENT_SECRET,
    CALENDLY_REDIRECT_URI,
    CALENDLY_AUTHORIZE_URL,
    CALENDLY_TOKEN_URL,
  };
};
export type AccessTokenSuccessResponse = {
  token_type: string;
  expires_in: number;
  created_at: number;
  refresh_token: string;
  access_token: string;
  scope: string;
  owner: string;
  organization: string;
};

export type AccessTokenErrorResponse = {
  error: string;
  error_description: string;
};

export type UserSuccessResponse = {
  resource: {
    uri: string;
    name: string;
    slug: string;
    email: string;
    scheduling_url: string;
    timezone: string;
    avatar_url: string;
    created_at: string;
    updated_at: string;
    current_organization: string;
    resource_type: "User";
  };
};

export type UserErrorResponse = {
  title: string;
  message: string;
  details: {
    parameter: string;
    message: string;
  }[];
};

/**
 * Basic Authentication scheme that contains the word Basic followed by a space and a base64-encoded string {CLIENT_ID}:{CLIENT_SECRET}
 * @returns {string} Basic Authentication scheme
 */
const getBasicAuthHeader = (): string => {
  const { CALENDLY_CLIENT_ID, CALENDLY_CLIENT_SECRET } = getCalendlyEnvVars();
  const credentials = Buffer.from(`${CALENDLY_CLIENT_ID}:${CALENDLY_CLIENT_SECRET}`).toString("base64");
  return `Basic ${credentials}`;
};

/**
 * Calendly's Authorization URL to receive an authorization code
 * @returns {string} Authorization URL
 */
export const getAuthorizationUrl = (): string => {
  const { CALENDLY_CLIENT_ID, CALENDLY_REDIRECT_URI, CALENDLY_AUTHORIZE_URL } = getCalendlyEnvVars();

  const queryParams = {
    client_id: CALENDLY_CLIENT_ID,
    redirect_uri: CALENDLY_REDIRECT_URI,
    response_type: "code",
  };
  if (typeof queryParams === "undefined") {
    throw new Error("CALENDLY_CLIENT_ID  env var is not defined");
  }

  return `${CALENDLY_AUTHORIZE_URL}?${new URLSearchParams(queryParams)}`;
};

/**
 * Exchanges the authorization code for the access_token and refresh_token.
 * @param {string} code - The authorization code received from the authentication flow.
 * @returns {Promise<{accessToken: string, refreshToken: string}>} An object containing the access token and refresh token.
 * @throws {Error} If there is an error fetching the access token or if the response is not successful.
 
 */
export const getAccessToken = async (
  code: string
): Promise<{
  accessToken: string;
  refreshToken: string;
}> => {
  const { CALENDLY_TOKEN_URL, CALENDLY_REDIRECT_URI } = getCalendlyEnvVars();

  const tokenData: Record<string, string> = {
    code,
    redirect_uri: CALENDLY_REDIRECT_URI ?? "",
    grant_type: "authorization_code",
  };

  try {
    const url = CALENDLY_TOKEN_URL;
    if (!url) {
      throw new Error("CALENDLY_TOKEN_URL  env var is not defined");
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // eslint-disable-next-line prettier/prettier
        Authorization: getBasicAuthHeader(),
      },
      body: new URLSearchParams(tokenData),
    });

    if (!response.ok) {
      const errorData: AccessTokenErrorResponse = await response.json();
      console.error("Error fetching access token:", errorData.error, errorData.error_description);
      throw new Error(errorData.error || "Error fetching access token");
    }
    const data: AccessTokenSuccessResponse = await response.json();
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error fetching access token:", error.message);
    } else {
      console.error("Error fetching access token:", String(error));
    }
    throw error;
  }
};

// /**
//  * Fetches  Calendly's user info via "/users/me" endpoint using current user's access_token.
//  * @param {string} accessToken - The access token received from the authentication flow.
//  * @returns {Promise<UserSuccessResponse | UserErrorResponse>} An object containing the access token .
//  * @throws {Error} If there is an error fetching the access token or if the response is not successful.
//  */
// export const getUserInfo = async (accessToken: string): Promise<UserSuccessResponse | UserErrorResponse> => {
//   try {
//     const response = await fetch(USER_INFO_URL, {
//       headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
//     });

//     if (!response.ok) {
//       const errorData: UserErrorResponse = await response.json();
//       console.error("Error fetching user info:", errorData.title, errorData.message);
//       throw new Error(errorData.message || "Error fetching user info");
//     }
//     const data: UserSuccessResponse = await response.json();

//     return data;
//   } catch (error) {
//     if (error instanceof Error) {
//       console.error("Error fetching access token:", error.message);
//     } else {
//       console.error("Error fetching access token:", String(error));
//     }
//     throw error;
//   }
// };
