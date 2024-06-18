import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Tooltip, Button } from "@calcom/ui";
import { Icon } from "@calcom/ui";

export interface ExportBookingsButtonProps {
  handleExportBookings: () => Promise<void>;
}

export default function ExportBookingsButton({ handleExportBookings }: ExportBookingsButtonProps) {
  const { t } = useLocale();

  return (
    <Button color="secondary" onClick={() => handleExportBookings()} className="mb-4">
      <Icon name="arrow-up-right-from-circle" className="h-4 w-4" />
      <Tooltip content={t("export_bookings_desc")}>
        <div className="mx-2">{t("export_bookings")}</div>
      </Tooltip>
    </Button>
  );
}
