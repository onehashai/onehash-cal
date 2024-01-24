import CalendlyOAuthProvider from "@onehash/calendly/utils/calendly-oauth-provider";
import type { NextApiRequest, NextApiResponse } from "next";

import { defaultHandler, defaultResponder } from "@calcom/lib/server";
import prisma from "@calcom/prisma";
import { IntegrationProvider } from "@calcom/prisma/client";

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  // const cookies = parse(req.headers.cookie || "");
  // const { calendlyAccessToken, calendlyRefreshToken } = cookies;
  // if(!calendlyAccessToken || !calendlyRefreshToken) {
  //   return res.status(400).json({ error: "Missing Calendly tokens" });
  // }

  const { userId } = req.query as { userId: string };
  if (!userId) {
    return res.status(400).json({ error: "Missing User ID" });
  }
  try {
    const userCalendlyIntegrationProvider = await prisma.integrationAccounts.findFirst({
      where: {
        userId: parseInt(userId),
        provider: IntegrationProvider.CALENDLY,
      },
    });
    if (!userCalendlyIntegrationProvider) {
      return res.json({ authorized: false });
    }
    return res.json({ authorized: true });
  } catch (e) {
    console.error("Internal Server Error:", String(e));
    return res.status(500).json({ error: "Internal Server Error", message: String(e) });
  }
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { code, userId } = req.body;
  console.log("code :", code, "\n id : ", userId);
  if (!code) {
    return res.status(400).json({ error: "Authorization code not provided" });
  }
  if (!userId) {
    return res.status(400).json({ error: "User ID not provided" });
  }

  try {
    const calendlyOAuthProvider = new CalendlyOAuthProvider({
      clientId: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
      clientSecret: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_SECRET ?? "",
      redirectUri: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI ?? "",
      oauthUrl: process.env.NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
    });
    const { access_token, refresh_token, token_type, expires_in, created_at, owner } =
      await calendlyOAuthProvider.getAccessToken(code);
    // check if integration account for the user exists
    const integrationAccount = await prisma.integrationAccounts.findFirst({
      where: {
        userId: userId,
        provider: IntegrationProvider.CALENDLY,
      },
    });
    //if already exists update the token configs
    if (integrationAccount) {
      await prisma.integrationAccounts.update({
        where: {
          userId_provider: {
            userId: userId,
            provider: IntegrationProvider.CALENDLY,
          },
        },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenType: token_type,
          expiresIn: expires_in,
          createdAt: created_at,
          ownerUniqIdentifier: owner,
        },
      });
    } else {
      //else adding new integration account and linking to user
      await prisma.user.update({
        where: {
          id: userId,
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
      });
      console.log("Creating new integration account and linking to user");
    }
    // res.setHeader("Set-Cookie", [
    //   `calendlyAccessToken=${access_token}; HttpOnly; Path=/; Max-Age=${expires_in}; SameSite=Lax`,
    //   `calendlyRefreshToken=${refresh_token}; HttpOnly; Path=/; Max-Age=${expires_in}; SameSite=Lax`,
    // ]);
    return res.send("Success authenticated");
  } catch (error) {
    console.error("Internal Server Error:", String(error));
    return res.status(500).json({ error: "Internal Server Error", message: String(error) });
  }
}
export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
