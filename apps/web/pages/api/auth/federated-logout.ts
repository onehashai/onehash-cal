import { withAppDirSsr } from "app/WithAppDirSsr";
import type { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";

import { getServerSideProps } from "@lib/federated-logout/getServerSideProps";
import { type inferSSRProps } from "@lib/types/inferSSRProps";

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
  const response = { url: `${endSessionEndPoint.href}?${endSessionParams}` };
  console.log("response: ", response);
  return NextResponse.json(response);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const getData = withAppDirSsr<inferSSRProps<typeof getServerSideProps>>(getServerSideProps);
    console.log("getData", getData);
    console.log(getServerSideProps);
    // if (cookieStore["keycloak-id_token"]) {
    //   return sendEndSessionEndpointToURL(cookieStore["keycloak-id_token"]);
    // }
    return res.status(200).json({ message: "Keycloak token id not found" });
  } catch (error) {
    return res.status(500);
  }
}
