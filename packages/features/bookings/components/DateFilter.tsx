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

  const handleDateChange = (newStartDate: string, newEndDate: string) => {
    const formattedStartDate = formatAndValidateDate(newStartDate, true);
    const formattedEndDate = formatAndValidateDate(newEndDate, false);

    setDateRange(formattedStartDate, formattedEndDate);
  };

  return (
    <DateRangePicker
      dates={{
        startDate: query.afterStartDate && dayjs(query.afterStartDate).toDate(),
        endDate: query.beforeEndDate && dayjs(query.beforeEndDate).toDate(),
      }}
      minDate={dayjs("2019-01-01").utc()}
      onDatesChange={({ startDate: newStartDate, endDate: newEndDate }) => {
        handleDateChange(newStartDate, newEndDate);
      }}
      placeholder={t("date_range")}
    />
  );
};
