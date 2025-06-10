import { WEBAPP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { TopBanner } from "@calcom/ui";

export function AddPaymentMethodBanner() {
  const { t } = useLocale();
  const { data } = trpc.viewer.teams.addPaymentMethod.useQuery();

  const openBillingPortal = async () => {
    const billingHref = `/api/integrations/stripepayment/portal?returnTo=${WEBAPP_URL}/teams`;
    window.open(billingHref, "_blank");
  };

  if (!data) return null;

  return (
    <TopBanner
      text={t("team_upgrade_banner_trial_description")}
      variant="warning"
      actions={
        <button
          className="border-b border-b-black"
          onClick={() => {
            openBillingPortal();
          }}>
          {t("upgrade_banner_action")}
        </button>
      }
    />
  );
}
