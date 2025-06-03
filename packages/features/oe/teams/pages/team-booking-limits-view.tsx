"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";

import { IntervalLimitsManager } from "@calcom/features/eventtypes/components/tabs/limits/EventLimitsTab";
import { AppearanceSkeletonLoader } from "@calcom/features/oe/components/AppearanceSkeletonLoader";
import SectionBottomActions from "@calcom/features/settings/SectionBottomActions";
import { classNames, validateIntervalLimitOrder } from "@calcom/lib";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useParamsWithFallback } from "@calcom/lib/hooks/useParamsWithFallback";
import { MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import type { RouterOutputs } from "@calcom/trpc/react";
import type { IntervalLimit } from "@calcom/types/Calendar";
import { Button, CheckboxField, Form, SettingsToggle, showToast } from "@calcom/ui";

interface TeamProfileConfig {
  team: RouterOutputs["viewer"]["teams"]["get"];
}

const TeamReservationLimitsController = ({ team }: TeamProfileConfig) => {
  const { t } = useLocale();
  const trpcUtilities = trpc.useUtils();

  const formController = useForm<{
    bookingLimits?: IntervalLimit;
    includeManagedEventsInLimits: boolean;
  }>({
    defaultValues: {
      bookingLimits: team?.bookingLimits || undefined,
      includeManagedEventsInLimits: team?.includeManagedEventsInLimits ?? false,
    },
  });

  const {
    formState: { isSubmitting, isDirty },
    reset: resetFormState,
  } = formController;

  const updateTeamMutation = trpc.viewer.teams.update.useMutation({
    onError: (errorResponse) => {
      showToast(errorResponse.message, "error");
    },
    async onSuccess(responseData) {
      await trpcUtilities.viewer.teams.get.invalidate();
      if (responseData) {
        resetFormState({
          bookingLimits: responseData.bookingLimits,
          includeManagedEventsInLimits: responseData.includeManagedEventsInLimits,
        });
      }
      showToast(t("booking_limits_updated_successfully"), "success");
    },
  });

  const hasAdminPrivileges =
    team && (team.membership.role === MembershipRole.OWNER || team.membership.role === MembershipRole.ADMIN);

  return (
    <>
      {hasAdminPrivileges ? (
        <>
          <Form
            form={formController}
            handleSubmit={(formValues) => {
              if (formValues.bookingLimits) {
                const orderValidation = validateIntervalLimitOrder(formValues.bookingLimits);
                if (!orderValidation) {
                  resetFormState();
                  throw new Error(t("event_setup_booking_limits_error"));
                }
              }
              updateTeamMutation.mutate({ ...formValues, id: team.id });
            }}>
            <Controller
              name="bookingLimits"
              render={({ field: { value: fieldValue } }) => {
                const hasActiveLimits = Object.keys(fieldValue ?? {}).length > 0;
                return (
                  <SettingsToggle
                    toggleSwitchAtTheEnd={true}
                    labelClassName="text-sm"
                    title={t("limit_booking_frequency")}
                    description={t("limit_team_booking_frequency_description")}
                    checked={hasActiveLimits}
                    onCheckedChange={(toggleState) => {
                      if (toggleState) {
                        formController.setValue("bookingLimits", {
                          PER_DAY: 1,
                        });
                      } else {
                        formController.setValue("bookingLimits", {});
                        formController.setValue("includeManagedEventsInLimits", false);
                      }
                      const currentBookingLimits = formController.getValues("bookingLimits");
                      const currentManagedEventsFlag = formController.getValues(
                        "includeManagedEventsInLimits"
                      );

                      updateTeamMutation.mutate({
                        bookingLimits: currentBookingLimits,
                        includeManagedEventsInLimits: currentManagedEventsFlag,
                        id: team.id,
                      });
                    }}
                    switchContainerClassName={classNames(
                      "border-subtle mt-6 rounded-lg border py-6 px-4 sm:px-6",
                      hasActiveLimits && "rounded-b-none"
                    )}
                    childrenClassName="lg:ml-0">
                    <div className="border-subtle border border-y-0 p-6">
                      <Controller
                        name="includeManagedEventsInLimits"
                        render={({ field: { value: checkboxValue, onChange: handleCheckboxChange } }) => (
                          <CheckboxField
                            description={t("count_managed_to_limit")}
                            descriptionAsLabel
                            onChange={(eventTarget) => handleCheckboxChange(eventTarget)}
                            checked={checkboxValue}
                          />
                        )}
                      />

                      <div className="pt-6">
                        <IntervalLimitsManager propertyName="bookingLimits" defaultLimit={1} step={1} />
                      </div>
                    </div>
                    <SectionBottomActions className="mb-6" align="end">
                      <Button disabled={isSubmitting || !isDirty} type="submit" color="primary">
                        {t("update")}
                      </Button>
                    </SectionBottomActions>
                  </SettingsToggle>
                );
              }}
            />
          </Form>
        </>
      ) : (
        <div className="border-subtle rounded-md border p-5">
          <span className="text-default text-sm">{t("only_owner_change")}</span>
        </div>
      )}
    </>
  );
};

const BookingLimitsViewWrapper = () => {
  const navigationRouter = useRouter();
  const routeParameters = useParamsWithFallback();

  const {
    data: teamData,
    isPending: isLoadingTeam,
    error: fetchError,
  } = trpc.viewer.teams.get.useQuery(
    { teamId: Number(routeParameters.id) },
    {
      enabled: !!Number(routeParameters.id),
    }
  );

  useEffect(
    function redirectOnErrorEffect() {
      if (fetchError) {
        navigationRouter.replace("/teams");
      }
    },
    [fetchError]
  );

  if (isLoadingTeam) return <AppearanceSkeletonLoader />;

  if (!teamData) return null;

  return <TeamReservationLimitsController team={teamData} />;
};

export default BookingLimitsViewWrapper;
