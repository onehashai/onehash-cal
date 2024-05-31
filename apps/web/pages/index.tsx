import type { GetServerSidePropsContext } from "next";
import nookies from "nookies";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { WEBAPP_URL, KEYCLOAK_COOKIE_DOMAIN, KEYCLOAK_TOKEN_SECRET } from "@calcom/lib/constants";
import { symmetricEncrypt } from "@calcom/lib/crypto";

function RedirectPage() {
  return;
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { req, res } = context;
  const session = await getServerSession({ req, res });

  const keycloak_cookie_domain = KEYCLOAK_COOKIE_DOMAIN || "";
  const keycloak_token_secret = KEYCLOAK_TOKEN_SECRET || "";
  const useSecureCookies = WEBAPP_URL?.startsWith("https://");

  if (session?.id_token) {
    const encoded_token = symmetricEncrypt(session.id_token, keycloak_token_secret);
    nookies.set(context, "keycloak-id_token", encoded_token, {
      domain: keycloak_cookie_domain,
      sameSite: useSecureCookies ? "none" : "lax",
      path: "/",
      secure: useSecureCookies,
      httpOnly: true,
    });
  }

  if (session?.access_token) {
    const encoded_token = symmetricEncrypt(session.access_token, keycloak_token_secret);
    nookies.set(context, "keycloak-access_token", encoded_token, {
      domain: keycloak_cookie_domain,
      sameSite: useSecureCookies ? "none" : "lax",
      path: "/",
      secure: useSecureCookies,
      httpOnly: true,
    });
  }

  if (session?.refresh_token) {
    const encoded_token = symmetricEncrypt(session.refresh_token, keycloak_token_secret);
    nookies.set(context, "keycloak-refresh_token", encoded_token, {
      domain: keycloak_cookie_domain,
      sameSite: useSecureCookies ? "none" : "lax",
      path: "/",
      secure: useSecureCookies,
      httpOnly: true,
    });
  }

  if (!session?.user?.id) {
    return { redirect: { permanent: false, destination: "/auth/login" } };
  }

  return { redirect: { permanent: false, destination: "/event-types" } };
}

export default RedirectPage;
