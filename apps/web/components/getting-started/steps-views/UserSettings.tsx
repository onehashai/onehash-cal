import { zodResolver } from "@hookform/resolvers/zod";
import { usePhoneNumberField, PhoneNumberField, isStrictlyValidNumber } from "@onehash/oe-features/ui";
import { isValidPhoneNumber } from "libphonenumber-js";
import { useEffect, useState, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import dayjs from "@calcom/dayjs";
import { useTimePreferences } from "@calcom/features/bookings/lib";
import { isPrismaObjOrUndefined } from "@calcom/lib";
import { FULL_NAME_LENGTH_MAX_LIMIT, PHONE_NUMBER_VERIFICATION_ENABLED } from "@calcom/lib/constants";
import { designationTypes, professionTypeAndEventTypes, customEvents } from "@calcom/lib/customEvents";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { usePhoneNumberVerification } from "@calcom/lib/hooks/usePhoneVerification";
import { telemetryEventTypes, useTelemetry } from "@calcom/lib/telemetry";
import { trpc } from "@calcom/trpc/react";
import { Button, TimezoneSelect, Icon, Input, Select, showToast } from "@calcom/ui";

import * as fbq from "@lib/fpixel";

import { UsernameAvailabilityField } from "@components/ui/UsernameAvailability";

interface IUserSettingsProps {
  nextStep: () => void;
  hideUsername?: boolean;
  isPhoneFieldMandatory?: boolean;
}

const UserSettings = (props: IUserSettingsProps) => {
  const { nextStep, isPhoneFieldMandatory = false } = props;
  const [user] = trpc.viewer.me.useSuspenseQuery();
  const { t } = useLocale();
  const { setTimezone: setSelectedTimeZone, timezone: selectedTimeZone } = useTimePreferences();
  const telemetry = useTelemetry();

  // Dynamic schema based on isPhoneFieldMandatory prop
  const userSettingsSchema = z.object({
    name: z
      .string()
      .min(1)
      .max(FULL_NAME_LENGTH_MAX_LIMIT, {
        message: t("max_limit_allowed_hint", { limit: FULL_NAME_LENGTH_MAX_LIMIT }),
      }),
    metadata: z.object({
      phoneNumber: isPhoneFieldMandatory
        ? z
            .string()
            .min(1, { message: t("phone_number_required") })
            .refine(
              (val) => {
                return isStrictlyValidNumber(val);
              },
              { message: t("invalid_phone_number") }
            )
        : z.string().refine(
            (val) => {
              return val === "" || isStrictlyValidNumber(val);
            },
            { message: t("invalid_phone_number") }
          ),
    }),
  });

  type UserFormValues = z.infer<typeof userSettingsSchema>;
  const defaultValues: UserFormValues = {
    name: user?.name || "",
    metadata: {
      phoneNumber: (isPrismaObjOrUndefined(user.metadata)?.phoneNumber as string) ?? "",
    },
  };
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
    control,
  } = useForm<z.infer<typeof userSettingsSchema>>({
    defaultValues,
    reValidateMode: "onChange",
    resolver: zodResolver(userSettingsSchema),
  });

  const watchedPhoneNumber = useWatch({
    control,
    name: "metadata.phoneNumber",
  });

  useEffect(() => {
    telemetry.event(telemetryEventTypes.onboardingStarted);
  }, [telemetry]);

  useEffect(() => {
    fbq.event("Registration_Completed");
  }, []);

  const utils = trpc.useUtils();
  const { data: eventTypes } = trpc.viewer.eventTypes.list.useQuery();

  const createEventType = trpc.viewer.eventTypes.create.useMutation();
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);

  const onSuccess = async () => {
    if (eventTypes?.length === 0 && selectedBusiness !== null) {
      await Promise.all(
        professionTypeAndEventTypes[selectedBusiness].map(async (event): Promise<void> => {
          const eventType = {
            ...event,
            title: customEvents[event.title],
            description: customEvents[event.description as string],
            length: (event.length as number[])[0],
            metadata: {
              multipleDuration: event.length as number[],
            },
          };
          return createEventType.mutate(eventType);
        })
      );
    }
    await utils.viewer.me.invalidate();
    nextStep();
  };

  const mutation = trpc.viewer.updateProfile.useMutation({
    onSuccess: onSuccess,
  });
  const { getValue: getPhoneValue, setValue: setPhoneValue } = usePhoneNumberField(
    { getValues, setValue },
    defaultValues,
    "metadata.phoneNumber"
  );

  const onSubmit = handleSubmit((data) => {
    if (
      isPhoneFieldMandatory &&
      data.metadata.phoneNumber &&
      (PHONE_NUMBER_VERIFICATION_ENABLED ? !numberVerified : false)
    ) {
      showToast(t("phone_verification_required"), "error");
      return;
    }

    mutation.mutate({
      metadata: {
        currentOnboardingStep: "connected-calendar",
        phoneNumber: data.metadata.phoneNumber,
      },
      name: data.name,
      timeZone: selectedTimeZone,
    });
  });

  const handlePhoneDelete = () => {
    mutation.mutate({
      metadata: {
        currentOnboardingStep: "connected-calendar",
      },
      name: getValues("name"),
      timeZone: selectedTimeZone,
    });
  };

  const designationTypeOptions: { value: string; label: string }[] = Object.keys(designationTypes).map(
    (key) => ({
      value: key,
      label: designationTypes[key],
    })
  );

  const { numberVerified } = usePhoneNumberVerification<UserFormValues>({
    getValues,
    defaultValues,
  });

  // Check if form can be submitted
  const canSubmit = useMemo(() => {
    if (selectedBusiness === null) return false;

    if (isPhoneFieldMandatory) {
      const phoneNumber = watchedPhoneNumber || "";
      return (
        phoneNumber &&
        isValidPhoneNumber(phoneNumber) &&
        (PHONE_NUMBER_VERIFICATION_ENABLED ? numberVerified : true)
      );
    }
    return true;
  }, [selectedBusiness, watchedPhoneNumber, numberVerified, isPhoneFieldMandatory]);

  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-6">
        {/* Username textfield: when not coming from signup */}
        {!props.hideUsername && (
          <UsernameAvailabilityField
            onSuccessMutation={async () => {
              showToast(t("settings_updated_successfully"), "success");
              await utils.viewer.me.invalidate();
            }}
            onErrorMutation={() => {
              showToast(t("error_updating_settings"), "error");
            }}
          />
        )}

        {/* Full name textfield */}
        <div className="w-full">
          <label htmlFor="name" className="text-default mb-2 block text-sm font-medium">
            {t("full_name")}
          </label>
          <Input
            {...register("name", {
              required: true,
            })}
            id="name"
            name="name"
            type="text"
            autoComplete="off"
            autoCorrect="off"
          />
          {errors.name && (
            <p data-testid="required" className="py-2 text-xs text-red-500">
              {errors.name.message}
            </p>
          )}
        </div>
        {/* <div className="mt-3 w-full">
          <Label className="flex">
            <p className="text-sm">
              {t("phone_number")}
              {isPhoneFieldMandatory && <span className="ml-1 text-red-500">*</span>}
            </p>
            <InfoBadge content={t("number_in_international_format")} />
          </Label>
          <div className="flex gap-3">
            <div className="w-full ">
              <PhoneInput
                value={getValues("metadata.phoneNumber")}
                onChange={(val) => {
                  setValue("metadata.phoneNumber", val || "", { shouldDirty: true });
                  const phoneNumber = val || "";
                  setIsNumberValid(isValidPhoneNumber(phoneNumber));
                  setNumberVerified(getNumberVerificationStatus(phoneNumber));
                }}
              />
            </div>

            <Button
              color="secondary"
              className="-ml-[2px] h-[38px] min-w-fit py-0 sm:block  "
              disabled={!isNumberValid || numberVerified}
              loading={isSendingCode}
              onClick={() =>
                sendVerificationCode({
                  phoneNumber: getValues("metadata.phoneNumber"),
                })
              }>
              {t("send_code")}
            </Button>

            {isNumberValid && defaultValues?.metadata?.phoneNumber != "" && !isPhoneFieldMandatory && (
              <Button
                color="destructive"
                className="-ml-[2px] h-[38px] min-w-fit py-0 sm:block  "
                disabled={!isNumberValid}
                onClick={() => {
                  setValue("metadata.phoneNumber", "", { shouldDirty: true });
                  setIsNumberValid(false);
                  mutation.mutate({
                    metadata: {
                      currentOnboardingStep: "connected-calendar",
                    },
                    name: getValues("name"),
                    timeZone: selectedTimeZone,
                  });
                }}>
                {t("delete")}
              </Button>
            )}
          </div>
          {errors.metadata?.phoneNumber && (
            <div className="mt-1 text-sm text-red-600">{errors.metadata.phoneNumber.message}</div>
          )}
          {numberVerified ? (
            <div className="mt-1">
              <Badge variant="green">{t("number_verified")}</Badge>
            </div>
          ) : (
            <>
              <div className="mt-3 flex  gap-3">
                <TextField
                  className="h-[38px] w-full"
                  placeholder="Verification code"
                  disabled={otpSent === false || isVerifying}
                  value={verificationCode}
                  onChange={(e) => {
                    setVerificationCode(e.target.value);
                  }}
                  required={isPhoneFieldMandatory}
                />
                <Button
                  color="secondary"
                  className="-ml-[2px] h-[38px] min-w-fit py-0 sm:block "
                  disabled={!verificationCode}
                  loading={isVerifying}
                  onClick={() => {
                    verifyPhoneNumber({
                      phoneNumber: getValues("metadata.phoneNumber") || "",
                      code: verificationCode,
                      teamId: undefined,
                    });
                  }}>
                  {t("verify")}
                </Button>
              </div>
            </>
          )}
        </div> */}
        <PhoneNumberField
          getValue={getPhoneValue}
          setValue={setPhoneValue}
          getValues={getValues}
          defaultValues={defaultValues}
          isRequired={isPhoneFieldMandatory}
          allowDelete={!isPhoneFieldMandatory && defaultValues?.metadata?.phoneNumber !== ""}
          hasExistingNumber={defaultValues?.metadata?.phoneNumber !== ""}
          errorMessage={errors.metadata?.phoneNumber?.message}
          onDeleteNumber={handlePhoneDelete}
          isNumberVerificationRequired={PHONE_NUMBER_VERIFICATION_ENABLED} // Only require OTP when phone is mandatory
        />
        {/* Designation select field */}
        <div className="w-full">
          <label htmlFor="timeZone" className="text-default block text-sm font-medium">
            {t("business_type")}
          </label>

          <Select
            className="mt-2 text-sm capitalize"
            onChange={(input) => {
              if (input) {
                setSelectedBusiness(input.value);
              }
            }}
            options={designationTypeOptions}
            // defaultValue={user?.metadata?.designation || designationTypeOptions[0]}
          />
        </div>
        {/* Timezone select field */}
        <div className="w-full">
          <label htmlFor="timeZone" className="text-default block text-sm font-medium">
            {t("timezone")}
          </label>

          <TimezoneSelect
            id="timeZone"
            value={selectedTimeZone}
            onChange={({ value }) => setSelectedTimeZone(value)}
            className="mt-2 w-full rounded-md text-sm"
          />

          <p className="text-subtle mt-3 flex flex-row font-sans text-xs leading-tight">
            {t("current_time")} {dayjs().tz(selectedTimeZone).format("LT").toString().toLowerCase()}
          </p>
        </div>
      </div>
      <Button
        type="submit"
        className="mt-8 flex w-full flex-row justify-center"
        loading={mutation.isPending}
        disabled={mutation.isPending || !canSubmit}>
        {t("next_step_text")}
        <Icon name="arrow-right" className="ml-2 h-4 w-4 self-center" aria-hidden="true" />
      </Button>
    </form>
  );
};

export { UserSettings };
