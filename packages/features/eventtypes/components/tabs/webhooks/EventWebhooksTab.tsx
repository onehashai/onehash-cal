import type { Webhook } from "@prisma/client";
import { Trans } from "next-i18next";
import Link from "next/link";
import { useState } from "react";
import { useFormContext } from "react-hook-form";

import type { FormValues, EventTypeSetupProps } from "@calcom/features/eventtypes/lib/types";
import useLockedFieldsManager from "@calcom/features/oe/managed-event-types/hooks/useLockedFieldsManager";
import { WebhookForm } from "@calcom/features/webhooks/components";
import EventTypeWebhookListItem from "@calcom/features/webhooks/components/EventTypeWebhookListItem";
import type { WebhookFormSubmitData } from "@calcom/features/webhooks/components/WebhookForm";
import { subscriberUrlReserved } from "@calcom/features/webhooks/lib/subscriberUrlReserved";
import { APP_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Alert, Button, Dialog, DialogContent, EmptyScreen, showToast } from "@calcom/ui";

export const EventWebhooksTab = ({ eventType }: Pick<EventTypeSetupProps, "eventType">) => {
  const { t } = useLocale();

  const utils = trpc.useUtils();
  const formMethods = useFormContext<FormValues>();

  const { data: webhooks } = trpc.viewer.webhook.list.useQuery({ eventTypeId: eventType.id });

  const { data: installedApps, isLoading } = trpc.viewer.integrations.useQuery({
    variant: "other",
    onlyInstalled: true,
  });

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [webhookToEdit, setWebhookToEdit] = useState<Webhook>();

  const editWebhookMutation = trpc.viewer.webhook.edit.useMutation({
    async onSuccess() {
      setEditModalOpen(false);
      showToast(t("webhook_updated_successfully"), "success");
      await utils.viewer.webhook.list.invalidate();
      await utils.viewer.eventTypes.get.invalidate();
    },
    onError(error) {
      showToast(`${error.message}`, "error");
    },
  });

  const createWebhookMutation = trpc.viewer.webhook.create.useMutation({
    async onSuccess() {
      setCreateModalOpen(false);
      showToast(t("webhook_created_successfully"), "success");
      await utils.viewer.webhook.list.invalidate();
      await utils.viewer.eventTypes.get.invalidate();
    },
    onError(error) {
      showToast(`${error.message}`, "error");
    },
  });

  const onCreateWebhook = async (values: WebhookFormSubmitData) => {
    if (
      subscriberUrlReserved({
        subscriberUrl: values.subscriberUrl,
        id: values.id,
        webhooks,
        eventTypeId: eventType.id,
      })
    ) {
      showToast(t("webhook_subscriber_url_reserved"), "error");
      return;
    }

    if (!values.payloadTemplate) {
      values.payloadTemplate = null;
    }

    createWebhookMutation.mutate({
      subscriberUrl: values.subscriberUrl,
      eventTriggers: values.eventTriggers,
      active: values.active,
      payloadTemplate: values.payloadTemplate,
      secret: values.secret,
      eventTypeId: eventType.id,
      time: values.time,
      timeUnit: values.timeUnit,
    });
  };

  const NewWebhookButton = () => {
    const { t } = useLocale();
    return (
      <Button
        color="secondary"
        data-testid="new_webhook"
        StartIcon="plus"
        onClick={() => setCreateModalOpen(true)}>
        {t("new_webhook")}
      </Button>
    );
  };

  const { shouldLockDisableProps, isChildrenManagedEventType, isManagedEventType } = useLockedFieldsManager({
    eventType,
    translate: t,
    formMethods,
  });
  const webhooksDisableProps = shouldLockDisableProps("webhooks", { simple: true });
  const lockedText = webhooksDisableProps.isLocked ? "locked" : "unlocked";
  const cannotEditWebhooks = isChildrenManagedEventType ? webhooksDisableProps.isLocked : false;
  return (
    <div>
      {webhooks && !isLoading && (
        <>
          <div>
            <div>
              <>
                {(isManagedEventType || isChildrenManagedEventType) && (
                  <Alert
                    severity={webhooksDisableProps.isLocked ? "neutral" : "green"}
                    className="mb-2"
                    title={
                      <Trans
                        i18nKey={`${lockedText}_${isManagedEventType ? "for_members" : "by_team_admins"}`}>
                        {lockedText[0].toUpperCase()}
                        {lockedText.slice(1)} {isManagedEventType ? "for members" : "by team admins"}
                      </Trans>
                    }
                    actions={
                      <div className="flex h-full items-center">{webhooksDisableProps.LockedIcon}</div>
                    }
                    message={
                      <Trans
                        i18nKey={`webhooks_${lockedText}_${
                          isManagedEventType ? "for_members" : "by_team_admins"
                        }_description`}>
                        {isManagedEventType ? "Members" : "You"}{" "}
                        {webhooksDisableProps.isLocked
                          ? "will be able to see the active webhooks but will not be able to edit any webhook settings"
                          : "will be able to see the active webhooks and will be able to edit any webhook settings"}
                      </Trans>
                    }
                  />
                )}
                {webhooks.length ? (
                  <>
                    <div className="border-subtle mb-2 rounded-md border p-8">
                      <div className="flex justify-between">
                        <div>
                          <div className="text-default text-sm font-semibold">{t("webhooks")}</div>
                          <p className="text-subtle max-w-[280px] break-words text-sm sm:max-w-[500px]">
                            {t("add_webhook_description", { appName: APP_NAME })}
                          </p>
                        </div>
                        {cannotEditWebhooks ? (
                          <Button StartIcon="lock" color="secondary" disabled>
                            {t("locked_by_team_admin")}
                          </Button>
                        ) : (
                          <NewWebhookButton />
                        )}
                      </div>

                      <div className="border-subtle my-8 rounded-md border">
                        {webhooks.map((webhook, index) => {
                          return (
                            <EventTypeWebhookListItem
                              key={webhook.id}
                              webhook={webhook}
                              lastItem={webhooks.length === index + 1}
                              onEditWebhook={() => {
                                setEditModalOpen(true);
                                setWebhookToEdit(webhook);
                              }}
                              readOnly={isChildrenManagedEventType && webhook.eventTypeId !== eventType.id}
                            />
                          );
                        })}
                      </div>

                      <p className="text-default text-sm font-normal">
                        <Trans i18nKey="edit_or_manage_webhooks">
                          If you wish to edit or manage your web hooks, please head over to &nbsp;
                          <Link
                            className="cursor-pointer font-semibold underline"
                            href="/settings/developer/webhooks">
                            webhooks settings
                          </Link>
                        </Trans>
                      </p>
                    </div>
                  </>
                ) : (
                  <EmptyScreen
                    Icon="webhook"
                    headline={t("create_your_first_webhook")}
                    description={t("first_event_type_webhook_description")}
                    buttonRaw={
                      cannotEditWebhooks ? (
                        <Button StartIcon="lock" color="secondary" disabled>
                          {t("locked_by_team_admin")}
                        </Button>
                      ) : (
                        <NewWebhookButton />
                      )
                    }
                  />
                )}
              </>
            </div>
          </div>

          {/* New webhook dialog */}
          <Dialog open={createModalOpen} onOpenChange={(isOpen) => !isOpen && setCreateModalOpen(false)}>
            <DialogContent
              enableOverflow
              title={t("create_webhook")}
              description={t("create_webhook_team_event_type")}>
              <WebhookForm
                noRoutingFormTriggers={true}
                onSubmit={onCreateWebhook}
                onCancel={() => setCreateModalOpen(false)}
                apps={installedApps?.items.map((app) => app.slug)}
              />
            </DialogContent>
          </Dialog>
          {/* Edit webhook dialog */}
          <Dialog open={editModalOpen} onOpenChange={(isOpen) => !isOpen && setEditModalOpen(false)}>
            <DialogContent enableOverflow title={t("edit_webhook")}>
              <WebhookForm
                noRoutingFormTriggers={true}
                webhook={webhookToEdit}
                apps={installedApps?.items.map((app) => app.slug)}
                onCancel={() => setEditModalOpen(false)}
                onSubmit={(values: WebhookFormSubmitData) => {
                  if (
                    subscriberUrlReserved({
                      subscriberUrl: values.subscriberUrl,
                      id: webhookToEdit?.id,
                      webhooks,
                      eventTypeId: eventType.id,
                    })
                  ) {
                    showToast(t("webhook_subscriber_url_reserved"), "error");
                    return;
                  }

                  if (values.changeSecret) {
                    values.secret = values.newSecret.length ? values.newSecret : null;
                  }

                  if (!values.payloadTemplate) {
                    values.payloadTemplate = null;
                  }

                  editWebhookMutation.mutate({
                    id: webhookToEdit?.id || "",
                    subscriberUrl: values.subscriberUrl,
                    eventTriggers: values.eventTriggers,
                    active: values.active,
                    payloadTemplate: values.payloadTemplate,
                    secret: values.secret,
                    eventTypeId: webhookToEdit?.eventTypeId || undefined,
                    timeUnit: values.timeUnit,
                    time: values.time,
                  });
                }}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};
