import CalendlyOAuthProvider from "@onehash/calendly/utils/calendly-oauth-provider";
import CalendlyService from "@onehash/calendly/utils/calendly-service";
import type { NextApiRequest, NextApiResponse } from "next";

import { defaultHandler, defaultResponder } from "@calcom/lib/server";
import prisma from "@calcom/prisma";
import { IntegrationProvider } from "@calcom/prisma/client";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { code, userEmail } = req.body;
  console.log("code :", code, "\n email : ", userEmail);
  if (!code) {
    return res.status(400).json({ error: "Authorization code not provided" });
  }
  if (!userEmail) {
    return res.status(400).json({ error: "User email not provided" });
  }

  try {
    const calendlyOAuthProvider = new CalendlyOAuthProvider({
      clientId: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
      clientSecret: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_SECRET ?? "",
      redirectUri: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI ?? "",
      authorizeUrl: process.env.NEXT_PUBLIC_CALENDLY_AUTHORIZE_URL ?? "",
      tokenUrl: process.env.NEXT_PUBLIC_CALENDLY_TOKEN_URL ?? "",
    });
    const { access_token, refresh_token, token_type, expires_in, created_at, owner } =
      await calendlyOAuthProvider.getAccessToken(code);
    const updatedIntegrationAccount = await prisma.user.update({
      where: {
        email: userEmail,
      },
      data: {
        integrationAccounts: {
          create: {
            accessToken: access_token,
            refreshToken: refresh_token,
            tokenType: token_type,
            expiresIn: expires_in,
            createdAt: created_at,
            provider: IntegrationProvider.CALENDLY,
            ownerUniqIdentifier: owner, // calendly user's unique identifier to access his resources
          },
        },
      },
      select: {
        integrationAccounts: true,
      },
    });
    console.log("integrationProvider", updatedIntegrationAccount);
    const calendlyService = new CalendlyService({
      accessToken: access_token,
      refreshToken: refresh_token,
      clientSecret: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_SECRET ?? "",
      clientID: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
      authorizeUrl: process.env.NEXT_PUBLIC_CALENDLY_AUTHORIZE_URL ?? "",
    });
    const userInfo = await calendlyService.getUserInfo();

    console.log("userInfo", userInfo);
    return res.send("Success authenticated");
  } catch (error) {
    console.error("Internal Server Error:", String(error));
    return res.status(500).json({ error: "Internal Server Error", message: String(error) });
  }
}
export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
