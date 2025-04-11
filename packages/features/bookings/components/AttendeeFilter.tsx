import { useState, useEffect } from "react";

import { useFilterQuery } from "@calcom/features/bookings/lib/useFilterQuery";
import {
  FilterCheckboxField,
  FilterCheckboxFieldsContainer,
} from "@calcom/features/filters/components/TeamsFilter";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { AnimatedPopover, Avatar, Divider, FilterSearchField } from "@calcom/ui";

type Attendee = {
  id: number;
  name: string | null;
  username?: string | null;
  email: string;
  timeZone: string;
  locale: string | null;
  phoneNumber: string | null;
  bookingId: number | null;
  noShow: boolean | null;
};

const debounce = <T extends (...args: any[]) => void>(func: T, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

export const AttendeeFilter = () => {
  const { t } = useLocale();
  const { data: query, pushItemToKey, removeItemByKeyAndValue } = useFilterQuery();
  const [searchText, setSearchText] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  const { mutate: getAttendees } = trpc.viewer.getAttendees.useMutation({
    onSuccess: (data) => {
      setAttendees(data);
    },
    onError: (err) => {
      console.error(err.message);
    },
  });

  const handleSearch = debounce((name: string) => {
    getAttendees({ name });
  }, 300);

  useEffect(() => {
    if (searchText.trim() !== "") {
      handleSearch(searchText);
    } else {
      setAttendees([]);
    }
  }, [searchText]);

  const getTextForPopover = () => {
    const attendees = query.attendees;
    return attendees ? `${t("number_selected", { count: attendees.length })}` : `${t("all")}`;
  };

  return (
    <AnimatedPopover text={getTextForPopover()} prefix={`${t("attendee")}: `}>
      <FilterCheckboxFieldsContainer>
        <Divider />
        <FilterSearchField onChange={(e) => setSearchText(e.target.value)} placeholder={t("search")} />
        {attendees.map((member) => (
          <FilterCheckboxField
            key={member.id}
            id={member.id.toString()}
            label={member.name ?? member.username ?? t("no_name")}
            checked={query.attendees?.includes(member.name ?? "")}
            onChange={(e) => {
              if (e.target.checked) {
                pushItemToKey("attendees", member.name ?? "");
              } else {
                removeItemByKeyAndValue("attendees", member.name ?? "");
              }
            }}
            icon={<Avatar alt={`${member.id} avatar`} size="xs" />}
          />
        ))}
        {attendees.length === 0 && (
          <h2 className="text-default px-4 py-2 text-sm font-medium">{t("no_options_available")}</h2>
        )}
      </FilterCheckboxFieldsContainer>
    </AnimatedPopover>
  );
};
