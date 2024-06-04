import type { GetServerSidePropsContext } from "next";
import nookies from "nookies";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { WEBAPP_URL, KEYCLOAK_COOKIE_DOMAIN } from "@calcom/lib/constants";
import prisma from "@calcom/prisma";

function RedirectPage() {
  return;
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { req, res } = context;
  const session = await getServerSession({ req, res });

  const keycloak_cookie_domain = KEYCLOAK_COOKIE_DOMAIN || "";
  const useSecureCookies = WEBAPP_URL?.startsWith("https://");

  if (session?.keycloak_token) {
    nookies.set(context, "keycloak_token", session.keycloak_token, {
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
