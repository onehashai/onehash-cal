import type { GetServerSidePropsContext } from "next";
import nookies from "nookies";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { WEBAPP_URL, KEYCLOAK_COOKIE_DOMAIN } from "@calcom/lib/constants";
import prisma from "@calcom/prisma";

import { ssrInit } from "@server/lib/ssr";

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const ssr = await ssrInit(context);
  const session = await getServerSession({ req: context.req, res: context.res });

  const keycloak_cookie_domain = KEYCLOAK_COOKIE_DOMAIN || "";
  const useSecureCookies = WEBAPP_URL?.startsWith("https://");

  const keycloak_token = nookies.get(context).keycloak_token;

  if (!keycloak_token && session?.keycloak_token) {
    nookies.set(context, "keycloak_token", session.keycloak_token, {
      domain: keycloak_cookie_domain,
      sameSite: useSecureCookies ? "none" : "lax",
      path: "/",
      secure: useSecureCookies,
      httpOnly: true,
    });
  }

  if (session) {
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
  }

  return { props: { trpcState: ssr.dehydrate() } };
};
