import { useAutoAnimate } from "@formkit/auto-animate/react";

import { PeopleFilter } from "@calcom/features/bookings/components/PeopleFilter";
import { useFilterQuery } from "@calcom/features/bookings/lib/useFilterQuery";
import { TeamsFilter } from "@calcom/features/filters/components/TeamsFilter";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useWhitelistCheck } from "@calcom/lib/hooks/useWhitelistCheck";
import { Tooltip, Button } from "@calcom/ui";

import { AttendeeFilter } from "./AttendeeFilter";
import { DateFilter } from "./DateFilter";
import { EventTypeFilter } from "./EventTypeFilter";

export interface FiltersContainerProps {
  isFiltersVisible: boolean;
}

export function FiltersContainer({ isFiltersVisible }: FiltersContainerProps) {
  const [animationParentRef] = useAutoAnimate<HTMLDivElement>();
  const { removeAllQueryParams } = useFilterQuery();
  const { t } = useLocale();
  //#WHITELISTED
  const { isUserWhiteListed } = useWhitelistCheck();
  return (
    <div ref={animationParentRef}>
      {isFiltersVisible ? (
        <div className="no-scrollbar flex w-full space-x-2 overflow-x-scroll rtl:space-x-reverse">
          <AttendeeFilter />
          <PeopleFilter />
          <EventTypeFilter />
          {isUserWhiteListed && <TeamsFilter />}
          <DateFilter />
          <Tooltip content={t("remove_filters")}>
            <Button
              color="secondary"
              type="button"
              onClick={() => {
                removeAllQueryParams();
              }}>
              {t("remove_filters")}
            </Button>
          </Tooltip>
        </div>
      ) : null}
    </div>
  );
}
