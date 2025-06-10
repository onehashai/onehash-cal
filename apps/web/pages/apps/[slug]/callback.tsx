import type { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { z } from "zod";

import { handleRazorpayOAuthRedirect } from "@calcom/app-store/razorpay/lib";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { useLocale } from "@calcom/lib/hooks/useLocale";

export default function Page(props: { error?: string }) {
  const { t } = useLocale();
  return (
    <div
      className="bg-default flex min-h-screen flex-col items-center justify-center px-4"
      data-testid="booking-payment-cb">
      <p className="text-emphasis text-sm font-semibold uppercase tracking-wide">{t("error_404")}</p>

      <h1 className="font-cal text-emphasis mt-2 text-4xl font-extrabold sm:text-5xl">
        {props.error || "App oauth redirection failed"}
      </h1>

      <Link
        href="/"
        className="text-emphasis hover:text-emphasis-dark mt-4 text-lg underline"
        data-testid="home-link">
        {t("go_back_home")}
      </Link>
    </div>
  );
}

const querySchema = z.object({
  slug: z.string(),
});

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { req, res, query } = context;
  const session = await getServerSession({ req, res });
  if (!session?.user?.id) throw new Error("User is not logged in");
  const parsedQuery = querySchema.safeParse(query);
  if (!parsedQuery.success) return { notFound: true } as const;
  const { slug } = parsedQuery.data;
  try {
    switch (slug) {
      case "razorpay":
        await handleRazorpayOAuthRedirect(query, session.user.id);
        return { redirect: { permanent: false, destination: "/apps/installed/payment" } };
      default:
        return {
          notFound: true,
        } as const;
    }
  } catch (error) {
    return {
      props: {
        error: error instanceof Error ? error?.message : "App oauth redirection failed",
      },
    };
  }
};
