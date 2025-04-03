import Link from "next/link";

import AppListCard from "@calcom/features/apps/components/AppListCard";
import DisconnectIntegration from "@calcom/features/apps/components/DisconnectIntegration";
import { CalendarSwitch } from "@calcom/features/calendars/CalendarSwitch";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { QueryCell } from "@calcom/trpc/components/QueryCell";
import { trpc } from "@calcom/trpc/react";
import { List, Alert, Switch, Icon, showToast } from "@calcom/ui";
import AdditionalCalendarSelector from "@calcom/web/components/apps/AdditionalCalendarSelector";

import { SelectedCalendarsSettings } from "../SelectedCalendarsSettings";

type SelectedCalendarsSettingsWebWrapperProps = {
  onChanged: () => unknown | Promise<unknown>;
  fromOnboarding?: boolean;
  destinationCalendarId?: string;
  isPending?: boolean;
  classNames?: string;
};

export const SelectedCalendarsSettingsWebWrapper = (props: SelectedCalendarsSettingsWebWrapperProps) => {
  const { t } = useLocale();
  const query = trpc.viewer.connectedCalendars.useQuery(undefined, {
    suspense: true,
    refetchOnWindowFocus: false,
  });
  const googleSyncMutation = trpc.viewer.googleSyncMutation.useMutation({
    onSuccess: () => {
      showToast(t("successfully_synced"), "success");
      // setIsOpenLocationDialog(false);
      // utils.viewer.bookings.invalidate();
    },
    onError: (e) => {
      const errorMessages: Record<string, string> = {
        UNAUTHORIZED: t("you_are_unauthorized_to_make_this_change_to_the_booking"),
        BAD_REQUEST: e.message,
      };
      const message = errorMessages[e.data?.code as string] || t("location_update_failed");
      showToast(message, "error");
    },
  });
  const { fromOnboarding, isPending } = props;

  return (
    <div>
      <QueryCell
        query={query}
        success={({ data }) => {
          if (!data.connectedCalendars.length) {
            return null;
          }

          return (
            <SelectedCalendarsSettings classNames={props.classNames}>
              <SelectedCalendarsSettingsHeading
                isConnectedCalendarsPresent={!!data.connectedCalendars.length}
                isPending={isPending}
              />
              <List noBorderTreatment className="p-6 pt-2">
                {data.connectedCalendars.map((connectedCalendar) => {
                  if (!!connectedCalendar.calendars && connectedCalendar.calendars.length > 0) {
                    return (
                      <AppListCard
                        key={`list-${connectedCalendar.credentialId}`}
                        shouldHighlight
                        slug={connectedCalendar.integration.slug}
                        title={connectedCalendar.integration.name}
                        logo={connectedCalendar.integration.logo}
                        description={
                          connectedCalendar.primary?.email ?? connectedCalendar.integration.description
                        }
                        className="border-subtle mt-4 rounded-lg border"
                        actions={
                          <div className="flex w-32 justify-end">
                            <DisconnectIntegration
                              credentialId={connectedCalendar.credentialId}
                              trashIcon
                              onSuccess={props.onChanged}
                              buttonProps={{ className: "border border-default" }}
                            />
                          </div>
                        }>
                        <div className="border-subtle border-t">
                          {!fromOnboarding && (
                            <>
                              <p className="text-subtle px-5 pt-4 text-sm">
                                {t("toggle_calendars_conflict")}
                              </p>

                              <ul className="space-y-4 px-5 py-4">
                                {connectedCalendar.calendars?.map((cal) => (
                                  <div className="border" key={cal.externalId}>
                                    <CalendarSwitch
                                      externalId={cal.externalId}
                                      title={cal.name || "Nameless calendar"}
                                      name={cal.name || "Nameless calendar"}
                                      type={connectedCalendar.integration.type}
                                      isChecked={cal.isSelected}
                                      destination={cal.externalId === props.destinationCalendarId}
                                      credentialId={cal.credentialId}
                                    />
                                    {cal.isSelected && cal.integration === "google_calendar" && (
                                      <div className="flex p-2">
                                        <Switch
                                          name="calendar_sync"
                                          checked={cal.googleSyncEnabled}
                                          label={t("calendar_sync")}
                                          onCheckedChange={(checked) => {
                                            googleSyncMutation.mutate({
                                              integration: cal.integration,
                                              externalId: cal.externalId,
                                              googleSyncEnabled: checked,
                                            });
                                          }}
                                        />
                                        {googleSyncMutation.isPending && (
                                          <Icon
                                            name="rotate-cw"
                                            className="text-muted h-4 w-4 animate-spin ltr:ml-1 rtl:mr-1"
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </AppListCard>
                    );
                  }
                  return (
                    <Alert
                      key={`alert-${connectedCalendar.credentialId}`}
                      severity="warning"
                      title={t("something_went_wrong")}
                      message={
                        <span>
                          <Link href={`/apps/${connectedCalendar.integration.slug}`}>
                            {connectedCalendar.integration.name}
                          </Link>
                          : {t("calendar_error")}
                        </span>
                      }
                      iconClassName="h-10 w-10 ml-2 mr-1 mt-0.5"
                      actions={
                        <div className="flex w-32 justify-end">
                          <DisconnectIntegration
                            credentialId={connectedCalendar.credentialId}
                            trashIcon
                            onSuccess={props.onChanged}
                            buttonProps={{ className: "border border-default" }}
                          />
                        </div>
                      }
                    />
                  );
                })}
              </List>
            </SelectedCalendarsSettings>
          );
        }}
      />
    </div>
  );
};

const SelectedCalendarsSettingsHeading = (props: {
  isConnectedCalendarsPresent: boolean;
  isPending?: boolean;
}) => {
  const { t } = useLocale();

  return (
    <div className="border-subtle border-b p-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-emphasis text-base font-semibold leading-5">{t("check_for_conflicts")}</h4>
          <p className="text-default text-sm leading-tight">{t("select_calendars")}</p>
        </div>
        <div className="flex flex-col xl:flex-row xl:space-x-5">
          {props.isConnectedCalendarsPresent && (
            <div className="flex items-center">
              <AdditionalCalendarSelector isPending={props.isPending} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
