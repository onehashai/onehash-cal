import dayjs from "@calcom/dayjs";
import { useFilterQuery } from "@calcom/features/bookings/lib/useFilterQuery";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { DateRangePicker } from "@calcom/ui";

export const DateFilter = () => {
  const { t } = useLocale();
  const { data: query, setDateRange } = useFilterQuery();

  const formatAndValidateDate = (date: string, isStart: boolean) => {
    const formattedDate = dayjs(date)
      .set("hour", isStart ? 0 : 23)
      .set("minute", isStart ? 0 : 59)
      .set("second", isStart ? 0 : 59)
      .format("YYYY-MM-DD HH:mm:ss");

    if (!dayjs(formattedDate).isValid()) {
      throw new Error("Invalid date format");
    }
    return formattedDate;
  };

  const handleDateChange = (newStartDate: Date | undefined, newEndDate: Date | undefined) => {
    if (!newStartDate || !newEndDate) return;

    const formattedStartDate = formatAndValidateDate(newStartDate.toISOString(), true);
    const formattedEndDate = formatAndValidateDate(newEndDate.toISOString(), false);

    setDateRange(formattedStartDate, formattedEndDate);
  };

  const minDate = dayjs("2019-01-01").toDate();
  const startDate = query.afterStartDate ? dayjs(query.afterStartDate).toDate() : new Date();
  const endDate = query.beforeEndDate ? dayjs(query.beforeEndDate).toDate() : undefined;

  return (
    <DateRangePicker
      dates={{
        startDate,
        endDate,
      }}
      minDate={minDate}
      onDatesChange={({ startDate: newStartDate, endDate: newEndDate }) => {
        handleDateChange(newStartDate, newEndDate);
      }}
      placeholder={t("date_range")}
    />
  );
};
