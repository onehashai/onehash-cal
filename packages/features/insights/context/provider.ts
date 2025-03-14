import type { BookingStatus, WorkflowMethods } from "@prisma/client";
import * as React from "react";

import type { Dayjs } from "@calcom/dayjs";

interface IFilter {
  dateRange: [Dayjs, Dayjs, null | string];
  selectedTimeView?: "year" | "week" | "month";
  selectedFilter?: Array<
    "user" | "event-type" | "routing_forms" | "booking_status" | `rf_${string}` | "type"
  > | null;
  selectedTeamId?: number | null;
  selectedTeamName?: string | null;
  selectedUserId?: number | null;
  selectedMemberUserId?: number | null;
  selectedEventTypeId?: number | null;
  selectedRoutingFormId?: string | null;
  selectedBookingStatus?: BookingStatus | "NO_BOOKING" | null;
  selectedRoutingFormFilter?: {
    fieldId: string;
    optionId: string;
  } | null;
  isAll?: boolean;
  initialConfig?: {
    teamId?: number | null;
    userId?: number | null;
    isAll?: boolean | null;
  };
  selectedType?: WorkflowMethods;
}

export type FilterContextType = {
  filter: IFilter;
  clearFilters: () => void;
  setConfigFilters: (config: Partial<IFilter>) => void;
};

export const FilterContext = React.createContext<FilterContextType | null>(null);

export function useFilterContext() {
  const context = React.useContext(FilterContext);

  if (!context) {
    throw new Error("useFilterContext must be used within a FilterProvider");
  }

  return context;
}

export function FilterProvider<F extends FilterContextType>(props: { value: F; children: React.ReactNode }) {
  return React.createElement(FilterContext.Provider, { value: props.value }, props.children);
}
