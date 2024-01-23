type UserSuccessResponse = {
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

type UserErrorResponse = {
  title: string;
  message: string;
  details: {
    parameter: string;
    message: string;
  }[];
};

// calendly-oauth-provider.ts
type AccessTokenSuccessResponse = {
  token_type: string;
  expires_in: number;
  created_at: number;
  refresh_token: string;
  access_token: string;
  scope: string;
  owner: string;
  organization: string;
};

type AccessTokenErrorResponse = {
  error: string;
  error_description: string;
};

export type { UserSuccessResponse, UserErrorResponse, AccessTokenSuccessResponse, AccessTokenErrorResponse };
