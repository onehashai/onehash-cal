import { Fragment } from "react";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";

import { useIsPlatform } from "@calcom/atoms/monorepo";
import { classNames } from "@calcom/lib";
import type { CreateEventTypeFormValues } from "@calcom/lib/hooks/useCreateEventType";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import slugify from "@calcom/lib/slugify";
import { SchedulingType } from "@calcom/prisma/enums";
import { Form, TextField, Tooltip } from "@calcom/ui";
import { Alert, RadioGroup as RadioArea } from "@calcom/ui";

type props = {
  isTeamAdminOrOwner: boolean;
  teamSlug?: string | null;
  teamId: number;
  isPending: boolean;
  urlPrefix?: string;
  form: UseFormReturn<CreateEventTypeFormValues>;
  handleSubmit: (values: CreateEventTypeFormValues) => void;
  isManagedEventType: boolean;
  SubmitButton: (isPending: boolean) => ReactNode;
};

export const TeamEventTypeForm = function (properties: props) {
  const platformCheck = useIsPlatform();

  const localizationTools = useLocale();

  const formMethods = properties.form;
  const registrationHandler = formMethods.register;
  const valueUpdater = formMethods.setValue;
  const currentFormState = formMethods.formState;

  const buildTooltipContent = function (isManaged: boolean, slug?: string | null) {
    if (isManaged) {
      return localizationTools.t("username_placeholder");
    }
    return `team/${slug}`;
  };

  const generateUrlDisplay = function (prefix?: string, isManaged?: boolean, slug?: string | null) {
    const baseContent = isManaged ? localizationTools.t("username_placeholder") : `team/${slug}`;
    if (!prefix) return `/${baseContent}/`;
    return `${prefix}/${baseContent}/`;
  };

  const handleTitleChange = function (event: React.ChangeEvent<HTMLInputElement>) {
    const newTitle = event.target.value;
    formMethods.setValue("title", newTitle);

    const hasSlugBeenTouched = currentFormState.touchedFields["slug"] !== undefined;
    if (!hasSlugBeenTouched) {
      formMethods.setValue("slug", slugify(newTitle));
    }
  };

  const handleSlugChange = function (event: React.ChangeEvent<HTMLInputElement>) {
    const slugValue = event.target.value;
    formMethods.setValue("slug", slugify(slugValue), { shouldTouch: true });
  };

  const handleSchedulingTypeChange = function (selectedValue: SchedulingType) {
    valueUpdater("schedulingType", selectedValue);
  };

  const renderUrlField = function () {
    const hasLongPrefix = properties.urlPrefix && properties.urlPrefix.length >= 21;
    const labelText = platformCheck
      ? "Slug"
      : hasLongPrefix
      ? `${localizationTools.t("url")}: ${properties.urlPrefix}`
      : localizationTools.t("url");

    const tooltipContent = hasLongPrefix
      ? buildTooltipContent(properties.isManagedEventType, properties.teamSlug)
      : generateUrlDisplay(properties.urlPrefix, properties.isManagedEventType, properties.teamSlug);

    const leadingAddon = platformCheck ? undefined : (
      <Tooltip content={tooltipContent}>
        <span className="max-w-24 md:max-w-56">
          {hasLongPrefix
            ? `/${buildTooltipContent(properties.isManagedEventType, properties.teamSlug)}/`
            : generateUrlDisplay(properties.urlPrefix, properties.isManagedEventType, properties.teamSlug)}
        </span>
      </Tooltip>
    );

    return (
      <div>
        <TextField
          label={labelText}
          required
          addOnLeading={leadingAddon}
          {...registrationHandler("slug")}
          onChange={handleSlugChange}
        />
        {properties.isManagedEventType && !platformCheck && (
          <p className="mt-2 text-sm text-gray-600">
            {localizationTools.t("managed_event_url_clarification")}
          </p>
        )}
      </div>
    );
  };

  const renderSchedulingOption = function (
    optionType: SchedulingType,
    titleKey: string,
    descriptionKey: string,
    testId?: string
  ) {
    const containerClasses = properties.isTeamAdminOrOwner ? "w-full" : "";
    const itemClasses =
      optionType === SchedulingType.COLLECTIVE && !properties.isTeamAdminOrOwner
        ? "w-full text-sm w-1/2"
        : "text-sm w-1/2";

    return (
      <RadioArea.Item
        {...registrationHandler("schedulingType")}
        value={optionType}
        className={classNames(itemClasses, properties.isTeamAdminOrOwner && "text-sm")}
        classNames={{ container: classNames(containerClasses) }}
        data-testid={testId}>
        <strong className="mb-1 block">{localizationTools.t(titleKey)}</strong>
        <p>{localizationTools.t(descriptionKey)}</p>
      </RadioArea.Item>
    );
  };

  const formContent = (
    <Fragment>
      <div className="mt-3 space-y-6 pb-11">
        <TextField
          type="hidden"
          labelProps={{ style: { display: "none" } }}
          {...registrationHandler("teamId", { valueAsNumber: true })}
          value={properties.teamId}
        />
        <TextField
          label={localizationTools.t("title")}
          placeholder={localizationTools.t("quick_chat")}
          data-testid="event-type-quick-chat"
          {...registrationHandler("title")}
          onChange={handleTitleChange}
        />
        {renderUrlField()}
        <div className="mb-4">
          <label htmlFor="schedulingType" className="text-default block text-sm font-bold">
            {localizationTools.t("assignment")}
          </label>
          {currentFormState.errors.schedulingType && (
            <Alert
              className="mt-1"
              severity="error"
              message={currentFormState.errors.schedulingType.message}
            />
          )}
          <RadioArea.Group
            onValueChange={handleSchedulingTypeChange}
            className={classNames("mt-1 flex gap-4", properties.isTeamAdminOrOwner && "flex-col")}>
            {renderSchedulingOption(SchedulingType.COLLECTIVE, "collective", "collective_description")}
            {renderSchedulingOption(SchedulingType.ROUND_ROBIN, "round_robin", "round_robin_description")}
            {properties.isTeamAdminOrOwner &&
              renderSchedulingOption(
                SchedulingType.MANAGED,
                "managed_event",
                "managed_event_description",
                "managed-event-type"
              )}
          </RadioArea.Group>
        </div>
      </div>
      {properties.SubmitButton(properties.isPending)}
    </Fragment>
  );

  return (
    <Form form={properties.form} handleSubmit={properties.handleSubmit}>
      {formContent}
    </Form>
  );
};
