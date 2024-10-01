import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Tooltip, Button } from "@calcom/ui";
import { Icon } from "@calcom/ui";

export interface ExportBookingsButtonProps {
  handleOnClickExportBookings: () => Promise<void>;
  isLoading: boolean;
}

export default function ExportBookingsButton({
  handleOnClickExportBookings,
  isLoading,
}: ExportBookingsButtonProps) {
  const { t } = useLocale();
  return (
    <Button
      loading={isLoading}
      disabled={isLoading}
      color="secondary"
      onClick={() => handleOnClickExportBookings()}
      className="mb-4">
      <Icon name="circle-arrow-out-up-right" className="h-4 w-4" />
      <Tooltip content={t("export_bookings_desc")}>
        <div className="mx-2">{t("export_bookings")}</div>
      </Tooltip>
    </Button>
  );
}
