import type { NextApiRequest, NextApiResponse } from "next";

import { isPrismaObj } from "@calcom/lib";
import prisma from "@calcom/prisma";

function logoutParams(token: string): Record<string, string> {
  return {
    id_token_hint: token,
    post_logout_redirect_uri: process.env.NEXT_PUBLIC_WEBAPP_URL || "",
  };
}

function sendEndSessionEndpointToURL(token: string) {
  const endSessionEndPoint = new URL(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`);
  const params: Record<string, string> = logoutParams(token);
  const endSessionParams = new URLSearchParams(params);
  const url = `${endSessionEndPoint.href}?${endSessionParams}`;
  return url;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.cookies["keycloak_token"]) {
      const keycloak_session = await prisma.keycloakSessionInfo.findUnique({
        where: {
          browserToken: req.cookies["keycloak_token"],
        },
      });
      if (!keycloak_session) {
        return res.status(500).json({ message: "Keycloak Session not found" });
      }

      const idToken =
        isPrismaObj(keycloak_session.metadata) && (keycloak_session.metadata?.id_token as string | undefined);
      if (!idToken) {
        return res.status(500).json({ message: "id_token not found in metadata" });
      }
      const url = sendEndSessionEndpointToURL(idToken);
      await prisma.keycloakSessionInfo.delete({
        where: {
          browserToken: req.cookies["keycloak_token"],
        },
      });
      res.status(200).json({ data: url });
    }
    return res.status(500).json({ message: "keycloak_token not found in browser" });
  } catch (error) {
    return res.status(500);
  }
}
