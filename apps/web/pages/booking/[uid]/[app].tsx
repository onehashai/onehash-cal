import { useLocale } from "@calcom/lib/hooks/useLocale";
import { HeadSeo } from "@calcom/ui";

import type { PageProps } from "~/bookings/views/booking-app-cb.getServerSideProps";

export { getServerSideProps } from "~/bookings/views/booking-app-cb.getServerSideProps";

export default function PaymentAppCB(props: PageProps) {
  const { t } = useLocale();

  return (
    <>
      <HeadSeo
        title={t("booking_app_cb")}
        description={t("booking_app_cb_description")}
        nextSeoProps={{
          nofollow: true,
          noindex: true,
        }}
      />

      <div
        className="bg-default flex min-h-screen flex-col items-center justify-center px-4"
        data-testid="booking-payment-cb">
        <p className="text-emphasis text-sm font-semibold uppercase tracking-wide">{t("error_404")}</p>
        {props.paymentStatus === "failed" && (
          <>
            <h1 className="font-cal text-emphasis mt-2 text-4xl font-extrabold sm:text-5xl">
              {t("payment_failed")}
            </h1>
            <p className="text-emphasis mt-4 text-lg">{t("payment_failed_description")}</p>
          </>
        )}
        {props.paymentStatus === "error" && (
          <>
            <h1 className="font-cal text-emphasis mt-2 text-4xl font-extrabold sm:text-5xl">
              {t("payment_error")}
            </h1>
            <p className="text-emphasis mt-4 text-lg">{t("payment_error_description")}</p>
          </>
        )}
        {/* Link to home page */}
        <a
          href="/"
          className="text-emphasis hover:text-emphasis-dark mt-4 text-lg underline"
          data-testid="home-link">
          {t("go_back_home")}
        </a>
      </div>
    </>
  );
}
