import type { AccessTokenErrorResponse, AccessTokenSuccessResponse } from "./calendly";

export default class CalendlyOAuthProvider {
  private oauthConfig: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authorizeUrl: string;
    tokenUrl: string;
  };

  constructor(_oauthConfig: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authorizeUrl: string;
    tokenUrl: string;
  }) {
    const { clientId, clientSecret, redirectUri, authorizeUrl, tokenUrl } = _oauthConfig;
    if (!clientId || !clientSecret || !redirectUri || !authorizeUrl || !tokenUrl)
      throw new Error("Missing Calendly OAuth configuration");
    this.oauthConfig = {
      clientId,
      clientSecret,
      redirectUri,
      authorizeUrl,
      tokenUrl,
    };
  }

  private getBasicAuthHeader(): string {
    const { clientId, clientSecret } = this.oauthConfig;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    return `Basic ${credentials}`;
  }

  public getAuthorizationUrl(): string {
    const { clientId, redirectUri, authorizeUrl } = this.oauthConfig;
    const queryParams = {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
    };

    return `${authorizeUrl}?${new URLSearchParams(queryParams)}`;
  }

  public getAccessToken = async (code: string): Promise<AccessTokenSuccessResponse> => {
    const { tokenUrl, redirectUri } = this.oauthConfig;

    const tokenData: Record<string, string> = {
      code,
      redirect_uri: redirectUri ?? "",
      grant_type: "authorization_code",
    };

    try {
      const url = tokenUrl;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: this.getBasicAuthHeader(),
        },
        body: new URLSearchParams(tokenData),
      });

      if (!response.ok) {
        const errorData: AccessTokenErrorResponse = await response.json();
        console.error("Error fetching access token:", errorData.error, errorData.error_description);
        throw new Error(errorData.error || "Error fetching access token");
      }
      const data: AccessTokenSuccessResponse = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error fetching access token:", error.message);
      } else {
        console.error("Error fetching access token:", String(error));
      }
      throw error;
    }
  };
}
