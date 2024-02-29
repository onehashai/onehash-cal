import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Tooltip, Button } from "@calcom/ui";
import { ArrowUpRightFromCircle } from "@calcom/ui/components/icon";

// import { LucideCalendarClock } from "@calcom/ui/components/icon";

export interface ExportBookingsButtonProps {
  handleExportBookings: () => Promise<void>;
}

export default function ExportBookingsButton({ handleExportBookings }: ExportBookingsButtonProps) {
  const { t } = useLocale();

  return (
    <Button color="secondary" onClick={() => handleExportBookings()} className="mb-4">
      <ArrowUpRightFromCircle className="h-4 w-4" />
      <Tooltip content={t("export_bookings_desc")}>
        <div className="mx-2">{t("export_bookings")}</div>
      </Tooltip>
    </Button>
  );
}
