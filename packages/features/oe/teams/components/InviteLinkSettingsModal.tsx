import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc";
import { Button, Dialog, DialogContent, DialogFooter, Form, Label, Select, showToast } from "@calcom/ui";

interface TeamInviteModalConfiguration {
  isOpen: boolean;
  teamId: number;
  token: string;
  expiresInDays?: number;
  onExit: () => void;
}

export interface LinkSettingsForm {
  expiresInDays: number | undefined;
}

const createExpirationOptions = (translator: any) => [
  { value: 1, label: translator("one_day") },
  { value: 7, label: translator("seven_days") },
  { value: 30, label: translator("thirty_days") },
  { value: undefined, label: translator("never_expires") },
];

const useInviteDeletion = (onComplete: () => void, utils: any) => {
  const { t } = useLocale();

  return trpc.viewer.teams.deleteInvite.useMutation({
    onSuccess: () => {
      showToast(t("invite_link_deleted"), "success");
      utils.viewer.teams.get.invalidate();
      utils.viewer.teams.list.invalidate();
      onComplete();
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });
};

const useExpirationUpdate = (utils: any) => {
  const { t } = useLocale();

  return trpc.viewer.teams.setInviteExpiration.useMutation({
    onSuccess: () => {
      showToast(t("invite_link_updated"), "success");
      utils.viewer.teams.get.invalidate();
      utils.viewer.teams.list.invalidate();
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });
};

export default function InviteLinkSettingsModal(config: TeamInviteModalConfiguration) {
  const { t } = useLocale();
  const queryUtils = trpc.useUtils();

  const removeLinkMutation = useInviteDeletion(config.onExit, queryUtils);
  const updateExpirationMutation = useExpirationUpdate(queryUtils);

  const expirationChoices = useMemo(() => createExpirationOptions(t), [t]);

  const formHandler = useForm<LinkSettingsForm>({
    defaultValues: {
      expiresInDays: config.expiresInDays,
    },
  });

  const processFormSubmission = (formData: LinkSettingsForm) => {
    updateExpirationMutation.mutate({
      token: config.token,
      expiresInDays: formData.expiresInDays,
    });
  };

  const handleModalClose = () => {
    config.onExit();
    formHandler.reset();
  };

  const executeInviteDeletion = () => {
    removeLinkMutation.mutate({ token: config.token });
  };

  const getSelectedOption = () => {
    return expirationChoices.find((choice) => choice.value === config.expiresInDays);
  };

  return (
    <Dialog open={config.isOpen} onOpenChange={handleModalClose}>
      <DialogContent type="creation" title="Invite link settings">
        <Form form={formHandler} handleSubmit={processFormSubmission}>
          <Controller
            name="expiresInDays"
            control={formHandler.control}
            render={({ field: { onChange } }) => (
              <div className="-mt-2">
                <Label className="text-emphasis font-medium" htmlFor="expiresInDays">
                  {t("link_expires_after")}
                </Label>
                <Select
                  options={expirationChoices}
                  defaultValue={getSelectedOption()}
                  className="w-full"
                  onChange={(selection) => onChange(selection?.value)}
                />
              </div>
            )}
          />
          <DialogFooter showDivider className="mt-10">
            <Button
              type="button"
              color="secondary"
              onClick={executeInviteDeletion}
              className="mr-auto"
              data-testid="copy-invite-link-button">
              {t("delete")}
            </Button>
            <Button type="button" color="minimal" onClick={config.onExit}>
              {t("back")}
            </Button>
            <Button
              type="submit"
              color="primary"
              className="me-2 ms-2"
              data-testid="invite-new-member-button">
              {t("save")}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
