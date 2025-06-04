import classNames from "classnames";
import React from "react";
import type { ITimezone } from "react-timezone-select";

import type { Dayjs } from "@calcom/dayjs";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import getSlots from "@calcom/lib/slots";
import { trpc } from "@calcom/trpc/react";

import SkeletonLoader from "./SkeletonLoaderAvailabilityTimes";

interface Props {
  teamId: number;
  memberId: number;
  selectedDate: Dayjs;
  selectedTimeZone: ITimezone;
  frequency: number;
  HeaderComponent?: React.ReactNode;
  className?: string;
}

const TeamAvailabilityTimes = function (properties: Props) {
  const localeHelpers = useLocale();

  const queryResult = trpc.viewer.teams.getMemberAvailability.useQuery(
    {
      teamId: properties.teamId,
      memberId: properties.memberId,
      dateFrom: properties.selectedDate.toString(),
      dateTo: properties.selectedDate.add(1, "day").toString(),
      timezone: String(properties.selectedTimeZone),
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const isDataLoading = queryResult.isPending;
  const memberData = queryResult.data;

  const calculateTimeSlots = function () {
    if (isDataLoading) return [];

    const slotParams = {
      frequency: properties.frequency,
      inviteeDate: properties.selectedDate,
      workingHours: memberData?.workingHours ?? [],
      minimumBookingNotice: 0,
      offsetStart: 0,
      eventLength: properties.frequency,
      organizerTimeZone: String(memberData?.timeZone ?? ""),
    };

    return getSlots(slotParams);
  };

  const availableSlots = calculateTimeSlots();

  const hasNoSlots = availableSlots.length === 0;
  const showSkeleton = isDataLoading && hasNoSlots;
  const showEmptyState = !isDataLoading && hasNoSlots;
  const showAvailableMessage = !isDataLoading && !hasNoSlots;

  const renderEmptyState = function () {
    return (
      <div className="flex flex-col items-center justify-center pt-4">
        <span className="text-subtle text-sm">{localeHelpers.t("no_available_slots")}</span>
      </div>
    );
  };

  const renderAvailableHeader = function () {
    if (!showAvailableMessage) return null;

    return <p className="text-default mb-3 text-sm">{localeHelpers.t("time_available")}</p>;
  };

  const renderTimeSlot = function (slot: ReturnType<typeof getSlots>[0]) {
    const formattedTime = slot.time.tz(properties.selectedTimeZone.toString()).format("HH:mm");

    return (
      <div key={slot.time.format()} className="flex flex-row items-center ">
        <a
          className="border-brand-default text-bookingdarker bg-default  min-w-48 mb-2 mr-3 block flex-grow rounded-md border py-2 text-center font-medium dark:border-transparent dark:bg-gray-600 "
          data-testid="time">
          {formattedTime}
        </a>
      </div>
    );
  };

  const renderSlotsList = function () {
    return (
      <div className="max-h-[390px] overflow-scroll">
        {availableSlots.map(function (timeSlot) {
          return renderTimeSlot(timeSlot);
        })}
      </div>
    );
  };

  const containerClasses = classNames("min-w-60 flex-grow pl-0", properties.className);

  return (
    <div className={containerClasses}>
      {properties.HeaderComponent}
      {showSkeleton && <SkeletonLoader />}
      {showEmptyState && renderEmptyState()}
      {showAvailableMessage && <React.Fragment>{renderAvailableHeader()}</React.Fragment>}
      {!hasNoSlots && renderSlotsList()}
    </div>
  );
};

export default TeamAvailabilityTimes;
