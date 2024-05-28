import type { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { localStorage } from "@calcom/lib/webstorage";

function logoutParams(token: string): Record<string, string> {
  return {
    id_token_hint: token,
    post_logout_redirect_uri: process.env.NEXT_PUBLIC_WEBAPP_URL || "",
  };
}

function handleEmptyToken() {
  const response = { error: "No session present" };
  const responseHeaders = { status: 400 };
  return NextResponse.json(response, responseHeaders);
}

function sendEndSessionEndpointToURL(token: string) {
  const endSessionEndPoint = new URL(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`);
  const params: Record<string, string> = logoutParams(token);
  const endSessionParams = new URLSearchParams(params);
  const response = { url: `${endSessionEndPoint.href}?${endSessionParams}` };
  console.log("response: ", response);
  return NextResponse.json(response);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession({ req, res });
    if (!session) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const idToken = localStorage.getItem("keycloak_id_token");
    console.log("idToken", idToken);
    if (idToken) {
      return sendEndSessionEndpointToURL(idToken);
    }
    return handleEmptyToken();
  } catch (error) {
    return res.status(500);
  }
}
