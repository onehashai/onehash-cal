import type { GetServerSidePropsContext } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

import { getLocale } from "@calcom/features/auth/lib/getLocale";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import isPrismaObj from "@calcom/lib/isPrismaObj";
import { UserRepository } from "@calcom/lib/server/repository/user";

import { ssrInit } from "@server/lib/ssr";

async function getRequestCountryOrigin(
  req: import("http").IncomingMessage & { cookies: Partial<{ [key: string]: string }> }
) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0] : req.socket?.remoteAddress;

  const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
  const geoData = await geoRes.json();
  const country = geoData.country || "IN";

  return country;
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { req } = context;

  const country = await getRequestCountryOrigin(req); // Default to IN if country not found
  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return { redirect: { permanent: false, destination: "/auth/login" } };
  }

  const ssr = await ssrInit(context);

  await ssr.viewer.me.prefetch();

  const user = await UserRepository.findUserTeams({
    id: session.user.id,
  });

  if (!user) {
    throw new Error("User from session not found");
  }

  const locale = await getLocale(context.req);
  let currentOnboardingStep: string | undefined = undefined;

  //to handle the case where the user has already reached a step in the onboarding process
  if (
    context.params?.step == undefined &&
    user.metadata &&
    isPrismaObj(user.metadata) &&
    user.metadata.hasOwnProperty("currentOnboardingStep")
  ) {
    currentOnboardingStep = user.metadata.currentOnboardingStep as string | undefined;
    if (currentOnboardingStep) {
      return { redirect: { permanent: true, destination: `/getting-started/${currentOnboardingStep}` } };
    }
  }
  return {
    props: {
      ...(await serverSideTranslations(locale || "en", ["common"])),
      trpcState: ssr.dehydrate(),
      hasPendingInvites: user.teams.find((team) => team.accepted === false) ?? false,
      // currentOnboardingStep: currentOnboardingStep ?? null,
      country,
    },
  };
};

// export type PageProps = inferSSRProps<typeof getServerSideProps>;
