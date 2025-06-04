import { useEffect, useState } from "react";

import dayjs from "@calcom/dayjs";
import LicenseRequired from "@calcom/features/oe/common/components/LicenseRequired";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import type { ITimezone } from "@calcom/ui";
import { Avatar, DatePicker, Label, Select, TimezoneSelect } from "@calcom/ui";

import TeamAvailabilityTimes from "./TeamAvailabilityTimes";

interface Props {
  team?: RouterOutputs["viewer"]["teams"]["get"];
  member?: RouterOutputs["viewer"]["teams"]["listMembers"]["members"][number];
}

const TeamAvailabilityModal = function (properties: Props) {
  const trpcUtils = trpc.useUtils();
  const currentDate = dayjs();
  const [dateSelection, updateDateSelection] = useState(currentDate);

  const getInitialTimezone = function () {
    const storedTimezone = localStorage.getItem("timeOption.preferredTimeZone");
    if (storedTimezone) return storedTimezone;

    const detectedTimezone = dayjs.tz.guess();
    return detectedTimezone || "Europe/London";
  };

  const [timezoneSelection, updateTimezoneSelection] = useState<ITimezone>(getInitialTimezone());

  const localeData = useLocale();

  const [slotDuration, updateSlotDuration] = useState<15 | 30 | 60>(30);

  useEffect(
    function () {
      trpcUtils.viewer.teams.getMemberAvailability.invalidate();
    },
    [trpcUtils, timezoneSelection, dateSelection]
  );

  const slotOptions: { value: 15 | 30 | 60; label: string }[] = [
    { value: 15, label: "15 minutes" },
    { value: 30, label: "30 minutes" },
    { value: 60, label: "60 minutes" },
  ];

  const memberAvatarUrl = `${WEBAPP_URL}/${properties.member?.username}/avatar.png`;
  const memberDisplayName = properties.member?.name ?? "";

  const renderMemberInfo = function () {
    return (
      <div className="flex">
        <Avatar size="md" imageSrc={memberAvatarUrl} alt={memberDisplayName} />
        <div className="flex items-center justify-center ">
          <span className="text-subtle ml-2 text-base font-semibold leading-4">{memberDisplayName}</span>
        </div>
      </div>
    );
  };

  const renderDateSelection = function () {
    return (
      <>
        <div className="text-brand-900 mb-5 mt-4 text-2xl font-semibold">{localeData.t("availability")}</div>
        <DatePicker
          minDate={new Date()}
          date={dateSelection.toDate() ?? currentDate.toDate()}
          onDatesChange={function (selectedDate) {
            updateDateSelection(dayjs(selectedDate));
          }}
        />
      </>
    );
  };

  const renderTimezoneSelector = function () {
    return (
      <>
        <Label className="mt-4">{localeData.t("timezone")}</Label>
        <TimezoneSelect
          id="timeZone"
          autoFocus
          value={timezoneSelection}
          className="w-64 rounded-md"
          onChange={function (timezoneOption) {
            updateTimezoneSelection(timezoneOption.value);
          }}
          classNamePrefix="react-select"
        />
      </>
    );
  };

  const renderSlotSelector = function () {
    return (
      <div className="mt-3">
        <Label>{localeData.t("slot_length")}</Label>
        <Select
          options={slotOptions}
          isSearchable={false}
          classNamePrefix="react-select"
          className="w-64"
          value={{ value: slotDuration, label: `${slotDuration} minutes` }}
          onChange={function (selectedOption) {
            const newDuration = selectedOption?.value ?? 30;
            updateSlotDuration(newDuration);
          }}
        />
      </div>
    );
  };

  const leftColumnContent = (
    <div className="col-span-1">
      {renderMemberInfo()}
      <div>
        {renderDateSelection()}
        {renderTimezoneSelector()}
      </div>
      {renderSlotSelector()}
    </div>
  );

  const rightColumnContent = (
    <div className="col-span-1 max-h-[500px]">
      {Boolean(properties.team?.id && properties.member) && (
        <TeamAvailabilityTimes
          teamId={properties.team!.id}
          memberId={properties.member!.id}
          frequency={slotDuration}
          selectedDate={dateSelection}
          selectedTimeZone={timezoneSelection}
        />
      )}
    </div>
  );

  const modalContent = (
    <>
      <div className="grid h-[400px] grid-cols-2 space-x-11 rtl:space-x-reverse">
        {leftColumnContent}
        {rightColumnContent}
      </div>
    </>
  );

  return <LicenseRequired>{modalContent}</LicenseRequired>;
};

export default TeamAvailabilityModal;
