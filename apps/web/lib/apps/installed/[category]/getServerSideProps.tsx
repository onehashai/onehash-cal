import type { GetServerSidePropsContext } from "next";
import { z } from "zod";

import { AppCategories } from "@calcom/prisma/enums";

export type querySchemaType = z.infer<typeof querySchema>;

export const querySchema = z.object({
  category: z.nativeEnum(AppCategories),
});

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  // get return_to cookie and redirect if needed
  const { cookies } = ctx.req;

  const returnTo = cookies["return_to"];

  if (cookies && returnTo) {
    ctx.res.setHeader("Set-Cookie", "return_to=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT");
    const redirect = {
      redirect: {
        destination: `${returnTo}`,
        permanent: false,
      },
    } as const;

    return redirect;
  }

  const params = querySchema.safeParse(ctx.params);

  if (!params.success) {
    const notFound = { notFound: true } as const;

    return notFound;
  }

  return {
    props: {
      category: params.data.category,
    },
  };
}
