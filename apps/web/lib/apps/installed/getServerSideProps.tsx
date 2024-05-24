import type { GetServerSidePropsContext } from "next/types";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { cookies } = ctx.req;

  const returnTo = cookies["return_to"];

  if (cookies && returnTo) {
    console.log("Redirecting to", returnTo);
    ctx.res.setHeader("Set-Cookie", "return_to=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT");
    const redirect = {
      redirect: {
        destination: `${returnTo}`,
        permanent: false,
      },
    } as const;

    return redirect;
  }

  return { redirect: { permanent: false, destination: "/apps/installed/calendar" } };
}
