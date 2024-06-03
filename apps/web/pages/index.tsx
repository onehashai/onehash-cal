import type { GetServerSidePropsContext } from "next";
import nookies from "nookies";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { WEBAPP_URL, KEYCLOAK_COOKIE_DOMAIN, KEYCLOAK_TOKEN_SECRET } from "@calcom/lib/constants";
import { symmetricEncrypt } from "@calcom/lib/crypto";
import prisma from "@calcom/prisma";

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
    nookies.set(context, "keycloak_id_token", encoded_token, {
      domain: keycloak_cookie_domain,
      sameSite: useSecureCookies ? "none" : "lax",
      path: "/",
      secure: useSecureCookies,
      httpOnly: true,
    });
  }

  if (session?.access_token) {
    const encoded_token = symmetricEncrypt(session.access_token, keycloak_token_secret);
    nookies.set(context, "keycloak_access_token", encoded_token, {
      domain: keycloak_cookie_domain,
      sameSite: useSecureCookies ? "none" : "lax",
      path: "/",
      secure: useSecureCookies,
      httpOnly: true,
    });
  }

  if (session?.refresh_token) {
    const encoded_token = symmetricEncrypt(session.refresh_token, keycloak_token_secret);
    nookies.set(context, "keycloak_refresh_token", encoded_token, {
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

  //to prevent the user from visiting the /event-types page if they have not completed the onboarding process
  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      completedOnboarding: true,
    },
  });
  if (!user) {
    throw new Error("User from session not found");
  }

  if (!user.completedOnboarding) {
    return { redirect: { permanent: true, destination: "/getting-started" } };
  }

  return { redirect: { permanent: false, destination: "/event-types" } };
}

export default RedirectPage;
