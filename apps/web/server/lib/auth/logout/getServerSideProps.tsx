import type { GetServerSidePropsContext } from "next";

import { ssrInit } from "@server/lib/ssr";

export async function getServerSideProps(context: GetServerSidePropsContext) {
  //redirect to sso login page as of now
  context.res.writeHead(302, { Location: "/auth/login" });
  context.res.end();
  return { props: {} };

  const ssr = await ssrInit(context);

  // Deleting old cookie manually, remove this code after all existing cookies have expired
  context.res?.setHeader(
    "Set-Cookie",
    "next-auth.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;"
  );

  return {
    props: {
      trpcState: ssr.dehydrate(),
      query: context.query,
    },
  };
}
