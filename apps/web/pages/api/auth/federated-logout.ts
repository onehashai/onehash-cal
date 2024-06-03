import type { NextApiRequest, NextApiResponse } from "next";

import { symmetricDecrypt } from "@calcom/lib/crypto";

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
    alert("inside federated-logout");
    if (req.cookies && req.cookies.keycloak_id_token) {
      const keycloak_token_secret = process.env.CALENDSO_ENCRYPTION_KEY || "";
      alert(`keycloak_token_secret: ${keycloak_token_secret}`);
      const id_token = symmetricDecrypt(req.cookies.keycloak_id_token, keycloak_token_secret);
      alert(`id_token: ${id_token}`);
      const url = sendEndSessionEndpointToURL(id_token);
      alert(`url: ${url}`);
      res.status(200).json({ data: url });
    }
    return res.status(500).json({ message: "Keycloak token id not found" });
  } catch (error) {
    return res.status(500);
  }
}
