import { sendTeamInviteEmail } from "@calcom/emails";
import { KEYCLOAK_CALLBACK_URI, KEYCLOAK_CLIENT_ID, SSO_BASE_URL, WEBAPP_URL } from "@calcom/lib/constants";
import { getTranslation } from "@calcom/lib/server/i18n";
import { prisma } from "@calcom/prisma";
import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";

import { ensureAtleastAdminPermissions, getTeamOrThrow } from "./inviteMember/utils";
import type { TResendInvitationInputSchema } from "./resendInvitation.schema";

type InviteMemberOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TResendInvitationInputSchema;
};

export const resendInvitationHandler = async ({ ctx, input }: InviteMemberOptions) => {
  const team = await getTeamOrThrow(input.teamId);

  await ensureAtleastAdminPermissions({
    userId: ctx.user.id,
    teamId:
      ctx.user.organization.id && ctx.user.organization.isOrgAdmin ? ctx.user.organization.id : input.teamId,
    isOrg: input.isOrg,
  });

  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      identifier: input.email,
      teamId: input.teamId,
    },
    select: {
      token: true,
    },
  });

  const inviteTeamOptions = {
    joinLink: `${WEBAPP_URL}/auth/login?callbackUrl=/teams`,
    isCalcomMember: true,
    isAutoJoin: false,
  };

  if (verificationToken) {
    if (KEYCLOAK_CALLBACK_URI && KEYCLOAK_CLIENT_ID && SSO_BASE_URL) {
      const sso_query_params = new URLSearchParams({
        client_id: KEYCLOAK_CLIENT_ID,
        redirect_uri: KEYCLOAK_CALLBACK_URI,
        response_type: "code",
        scope: "openid",
      }).toString();

      // Token only exists if user is CAL user but hasn't completed onboarding.
      inviteTeamOptions.joinLink = `${SSO_BASE_URL}?${sso_query_params}`;
    }
    inviteTeamOptions.isCalcomMember = false;
  }

  const translation = await getTranslation(input.language ?? "en", "common");

  await sendTeamInviteEmail({
    language: translation,
    from: ctx.user.name || `${team.name}'s admin`,
    to: input.email,
    teamName: team.name,
    ...inviteTeamOptions,
    isOrg: input.isOrg,
    parentTeamName: team?.parent?.name,
    // We don't know at his moment if this user was an existing user or a new user as it is a resend. So, we assume it's a new user and we can avoid sending the prevLink and newLink.
    isExistingUserMovedToOrg: false,
    prevLink: null,
    newLink: null,
    hideBranding: team.hideBranding,
    bannerUrl: team.bannerUrl ?? undefined,
  });

  return input;
};

export default resendInvitationHandler;
