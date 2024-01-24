import jackson from "@calcom/features/ee/sso/lib/jackson";
import { canAccess, samlProductID, samlTenantID, tenantPrefix } from "@calcom/features/ee/sso/lib/saml";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../trpc";
import type { TUpdateOIDCInputSchema } from "./updateOIDC.schema";

type UpdateOIDCOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TUpdateOIDCInputSchema;
};

export const updateOIDCHandler = async ({ ctx, input }: UpdateOIDCOptions) => {
  const { userId, clientId, clientSecret, wellKnownUrl } = input;

  const { message, access } = await canAccess(ctx.user);

  if (!access) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message,
    });
  }

  const { connectionController } = await jackson();

  try {
    return await connectionController.createOIDCConnection({
      defaultRedirectUrl: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/api/auth/saml/idp`,
      redirectUrl: JSON.stringify([`${process.env.NEXT_PUBLIC_WEBAPP_URL}/*`]),
      tenant: userId ? tenantPrefix + userId : samlTenantID,
      product: samlProductID,
      oidcClientId: clientId,
      oidcClientSecret: clientSecret,
      oidcDiscoveryUrl: wellKnownUrl,
    });
  } catch (err) {
    console.error("Error updating OIDC connection", err);
    throw new TRPCError({ code: "BAD_REQUEST", message: "Updating OIDC Connection failed." });
  }
};
