import { useSession } from "next-auth/react";
import { Trans } from "next-i18next";
import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import TeamInviteFromOrg from "@calcom/features/oe/organizations/components/TeamInviteFromOrg";
import { classNames } from "@calcom/lib";
import { IS_TEAM_BILLING_ENABLED_CLIENT, MAX_NB_INVITES } from "@calcom/lib/constants";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { MembershipRole } from "@calcom/prisma/enums";
import type { RouterOutputs } from "@calcom/trpc";
import { trpc } from "@calcom/trpc";
import { isEmail } from "@calcom/trpc/server/routers/viewer/teams/util";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Form,
  Icon,
  Label,
  Select,
  showToast,
  TextAreaField,
  TextField,
  ToggleGroup,
} from "@calcom/ui";

import type { PendingMember } from "../lib/types";
import { GoogleWorkspaceInviteButton } from "./GoogleWorkspaceInviteButton";

type MemberInvitationModalProps = {
  isOpen: boolean;
  onExit: () => void;
  orgMembers?: RouterOutputs["viewer"]["organizations"]["getMembers"];
  onSubmit: (values: NewMemberForm, resetFields: () => void) => void;
  onSettingsOpen?: () => void;
  teamId: number;
  members?: PendingMember[];
  token?: string;
  isPending?: boolean;
  disableCopyLink?: boolean;
  isOrg?: boolean;
  checkMembershipMutation?: boolean;
};

type MembershipRoleOption = {
  value: MembershipRole;
  label: string;
};

export interface NewMemberForm {
  emailOrUsername: string | string[];
  role: MembershipRole;
}

type ModalMode = "INDIVIDUAL" | "BULK" | "ORGANIZATION";

interface FileEvent<T = Element> extends FormEvent<T> {
  target: EventTarget & T;
}

const modifyArrayWithElement = (
  existingData: string[] | string | undefined,
  targetElement: string
): string[] => {
  let workingArray: string[];

  if (!existingData) {
    workingArray = [];
  } else if (typeof existingData === "string") {
    workingArray = [existingData];
  } else {
    workingArray = existingData;
  }

  const elementExists = workingArray.indexOf(targetElement) !== -1;

  if (elementExists) {
    return workingArray.filter((entry) => entry !== targetElement);
  } else {
    return [...workingArray, targetElement];
  }
};

export default function MemberInvitationModal(props: MemberInvitationModalProps) {
  const localeData = useLocale();
  const shouldHideCopyLink = props.disableCopyLink ?? false;
  const isOrganizationMode = props.isOrg ?? false;
  const apiContext = trpc.useUtils();
  const authSession = useSession();
  const organizationQuery = trpc.viewer.organizations.listCurrent.useQuery(undefined, {
    enabled: Boolean(authSession.data?.user?.org),
  });

  const membershipValidation = trpc.viewer.teams.checkIfMembershipExists.useMutation();

  const hasOrgAdminPrivileges =
    organizationQuery.data &&
    (organizationQuery.data.user.role === MembershipRole.OWNER ||
      organizationQuery.data.user.role === MembershipRole.ADMIN);

  const organizationViewEnabled = organizationQuery.data?.isPrivate
    ? hasOrgAdminPrivileges
    : Boolean(props.orgMembers?.length && hasOrgAdminPrivileges);

  const [selectedMode, updateSelectedMode] = useState<ModalMode>(
    organizationViewEnabled ? "ORGANIZATION" : "INDIVIDUAL"
  );

  const inviteLinkCreation = trpc.viewer.teams.createInvite.useMutation({
    onSuccess: async function ({ inviteLink }) {
      await apiContext.viewer.teams.get.invalidate();
      await apiContext.viewer.teams.list.invalidate();
    },
    onError: function (err) {
      showToast(err.message, "error");
    },
  });

  const roleSelectionOptions: MembershipRoleOption[] = useMemo(
    function () {
      const baseOptions: MembershipRoleOption[] = [
        { value: MembershipRole.MEMBER, label: localeData.t("member") },
        { value: MembershipRole.ADMIN, label: localeData.t("admin") },
        { value: MembershipRole.OWNER, label: localeData.t("owner") },
      ];

      if (isOrganizationMode && !hasOrgAdminPrivileges) {
        return baseOptions.filter((opt) => opt.value !== MembershipRole.OWNER);
      }

      return baseOptions;
    },
    [localeData, hasOrgAdminPrivileges, isOrganizationMode]
  );

  const modeSelectionOptions = useMemo(
    function () {
      const choices = [
        {
          value: "INDIVIDUAL",
          label: localeData.t("invite_team_individual_segment"),
          iconLeft: <Icon name="user" />,
        },
        {
          value: "BULK",
          label: localeData.t("invite_team_bulk_segment"),
          iconLeft: <Icon name="users" />,
        },
      ];

      if (organizationViewEnabled) {
        choices.unshift({
          value: "ORGANIZATION",
          label: localeData.t("organization"),
          iconLeft: <Icon name="building" />,
        });
      }

      return choices;
    },
    [localeData, organizationViewEnabled]
  );

  const formController = useForm<NewMemberForm>();

  const verifyMembershipStatus = async function (identifier: string) {
    if (props.checkMembershipMutation) {
      const result = await membershipValidation.mutateAsync({
        teamId: props.teamId,
        value: identifier,
      });
      return result;
    } else {
      if (!props.members?.length) return false;

      const matchFound = props.members.some(
        (participant) => participant.username === identifier || participant.email === identifier
      );

      return matchFound;
    }
  };

  const processFileData = function (evt: FileEvent<HTMLInputElement>) {
    const uploadedFiles = evt.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const targetFile = uploadedFiles[0];
    if (!targetFile) return;

    const fileProcessor = new FileReader();
    const emailPattern = /^([A-Z0-9_+-]+\.?)*[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;

    fileProcessor.onload = function (loadEvent) {
      const textContent = loadEvent.target?.result as string;
      const lineItems = textContent.split("\n");
      const extractedEmails: string[] = [];

      lineItems.forEach(function (singleLine) {
        const segments = singleLine.split(/,|;|\|| /);

        for (let idx = 0; idx < segments.length; idx++) {
          const cleanedEmail = segments[idx].trim().toLowerCase();

          if (emailPattern.test(cleanedEmail)) {
            extractedEmails.push(cleanedEmail);
            break;
          }
        }
      });

      formController.setValue("emailOrUsername", extractedEmails);
    };

    fileProcessor.readAsText(targetFile);
  };

  const clearFormData = function () {
    formController.reset();
    formController.setValue("emailOrUsername", "");
    formController.setValue("role", roleSelectionOptions[0].value);
    updateSelectedMode("INDIVIDUAL");
  };

  const fileInputElement = useRef<HTMLInputElement | null>(null);

  return (
    <Dialog
      name="inviteModal"
      open={props.isOpen}
      onOpenChange={function () {
        props.onExit();
        formController.reset();
      }}>
      <DialogContent
        enableOverflow
        type="creation"
        title={localeData.t("invite_team_member")}
        description={
          IS_TEAM_BILLING_ENABLED_CLIENT && !organizationQuery.data ? (
            <span className="text-subtle text-sm leading-tight">
              <Trans i18nKey="invite_new_member_description">
                Note: This will <span className="text-emphasis font-medium">cost an extra seat ($15/m)</span>{" "}
                on your subscription.
              </Trans>
            </span>
          ) : null
        }>
        <div className="sm:max-h-9">
          <Label className="sr-only" htmlFor="role">
            {localeData.t("import_mode")}
          </Label>
          <ToggleGroup
            isFullWidth={true}
            className="flex-col sm:flex-row"
            onValueChange={function (selection) {
              updateSelectedMode(selection as ModalMode);
              formController.clearErrors();
            }}
            defaultValue={selectedMode}
            options={modeSelectionOptions}
          />
        </div>

        <Form
          form={formController}
          handleSubmit={function (formData) {
            props.onSubmit(formData, clearFormData);
          }}>
          <div className="mb-10 mt-6 space-y-6">
            {selectedMode === "INDIVIDUAL" && (
              <Controller
                name="emailOrUsername"
                control={formController.control}
                rules={{
                  required: localeData.t("enter_email"),
                  validate: async function (input) {
                    if (typeof input === "string" && !isEmail(input)) {
                      return localeData.t("enter_email");
                    }
                    if (typeof input === "string") {
                      const alreadyExists = await verifyMembershipStatus(input);
                      return !alreadyExists || localeData.t("member_already_invited");
                    }
                  },
                }}
                render={function ({ field: { onChange }, fieldState: { error } }) {
                  return (
                    <>
                      <TextField
                        label={localeData.t("email")}
                        id="inviteUser"
                        name="inviteUser"
                        placeholder="email@example.com"
                        required
                        onChange={function (evt) {
                          onChange(evt.target.value.trim().toLowerCase());
                        }}
                      />
                      {error && <span className="text-sm text-red-800">{error.message}</span>}
                    </>
                  );
                }}
              />
            )}
            {selectedMode === "BULK" && (
              <div className="bg-muted flex flex-col rounded-md p-4">
                <Controller
                  name="emailOrUsername"
                  control={formController.control}
                  rules={{
                    required: localeData.t("enter_email"),
                    validate: function (input) {
                      if (Array.isArray(input)) {
                        const hasInvalidEmail = input.some((addr) => !isEmail(addr));
                        if (hasInvalidEmail) return localeData.t("enter_emails");

                        if (input.length > MAX_NB_INVITES) {
                          return localeData.t("too_many_invites", { nbUsers: MAX_NB_INVITES });
                        }
                      }

                      if (typeof input === "string" && !isEmail(input)) {
                        return localeData.t("enter_email");
                      }
                    },
                  }}
                  render={function ({ field: { onChange, value }, fieldState: { error } }) {
                    return (
                      <>
                        <TextAreaField
                          name="emails"
                          label={localeData.t("invite_via_email")}
                          rows={4}
                          autoCorrect="off"
                          placeholder="john@doe.com, alex@smith.com"
                          required
                          value={value}
                          onChange={function (evt) {
                            const rawInput = evt.target.value;
                            const splitValues = rawInput.split(/[\n,]/);

                            let processedEmails;
                            if (splitValues.length === 1) {
                              processedEmails = splitValues[0].trim().toLocaleLowerCase();
                            } else {
                              processedEmails = splitValues.map((addr) => addr.trim().toLocaleLowerCase());
                            }

                            onChange(processedEmails);
                          }}
                        />
                        {error && <span className="text-sm text-red-800">{error.message}</span>}
                      </>
                    );
                  }}
                />

                <GoogleWorkspaceInviteButton
                  onSuccess={function (importedData) {
                    formController.setValue("emailOrUsername", importedData);
                  }}
                />
                <Button
                  type="button"
                  color="secondary"
                  onClick={function () {
                    fileInputElement.current?.click();
                  }}
                  StartIcon="paperclip"
                  className="mt-3 justify-center stroke-2">
                  {localeData.t("upload_csv_file")}
                </Button>
                <input
                  ref={fileInputElement}
                  hidden
                  id="bulkInvite"
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={processFileData}
                />
              </div>
            )}
            {selectedMode === "ORGANIZATION" && (
              <Controller
                name="emailOrUsername"
                control={formController.control}
                rules={{
                  required: localeData.t("enter_email_or_username"),
                }}
                render={function ({ field: { onChange, value } }) {
                  return (
                    <>
                      <TeamInviteFromOrg
                        selectedEmails={value}
                        handleOnChecked={function (emailAddress) {
                          const updatedSelection = modifyArrayWithElement(value, emailAddress);
                          onChange(updatedSelection);
                        }}
                        orgMembers={props.orgMembers}
                      />
                    </>
                  );
                }}
              />
            )}
            <Controller
              name="role"
              control={formController.control}
              defaultValue={roleSelectionOptions[0].value}
              render={function ({ field: { onChange } }) {
                return (
                  <div>
                    <Label className="text-emphasis font-medium" htmlFor="role">
                      {localeData.t("invite_as")}
                    </Label>
                    <Select
                      id="role"
                      defaultValue={roleSelectionOptions[0]}
                      options={roleSelectionOptions}
                      onChange={function (selection) {
                        if (selection) onChange(selection.value);
                      }}
                    />
                  </div>
                );
              }}
            />
            {props.token && (
              <div className="flex">
                <Button
                  type="button"
                  color="minimal"
                  className="me-2 ms-2"
                  onClick={function () {
                    props.onSettingsOpen?.();
                    formController.reset();
                  }}
                  data-testid="edit-invite-link-button">
                  {localeData.t("edit_invite_link")}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter showDivider>
            {!shouldHideCopyLink && (
              <div className="flex-grow">
                <Button
                  type="button"
                  color="minimal"
                  variant="icon"
                  onClick={async function () {
                    try {
                      if (typeof ClipboardItem !== "undefined") {
                        const clipboardContent = new ClipboardItem({
                          "text/plain": new Promise(async function (resolve) {
                            const generatedLink = await inviteLinkCreation.mutateAsync({
                              teamId: props.teamId,
                              token: props.token,
                            });
                            showToast(localeData.t("invite_link_copied"), "success");
                            resolve(new Blob([generatedLink.inviteLink], { type: "text/plain" }));
                          }),
                        });
                        await navigator.clipboard.write([clipboardContent]);
                      } else {
                        const generatedLink = await inviteLinkCreation.mutateAsync({
                          teamId: props.teamId,
                          token: props.token,
                        });
                        await navigator.clipboard.writeText(generatedLink.inviteLink);
                        showToast(localeData.t("invite_link_copied"), "success");
                      }
                    } catch (err) {
                      showToast(localeData.t("something_went_wrong_on_our_end"), "error");
                      console.error(err);
                    }
                  }}
                  className={classNames("gap-2", props.token && "opacity-50")}
                  data-testid="copy-invite-link-button">
                  <Icon name="link" className="text-default h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{localeData.t("copy_invite_link")}</span>
                </Button>
              </div>
            )}
            <Button
              type="button"
              color="minimal"
              onClick={function () {
                props.onExit();
                clearFormData();
              }}>
              {localeData.t("cancel")}
            </Button>
            <Button
              loading={props.isPending || inviteLinkCreation.isPending || membershipValidation.isPending}
              type="submit"
              color="primary"
              className="me-2 ms-2"
              data-testid="invite-new-member-button">
              {localeData.t("send_invite")}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export const MemberInvitationModalWithoutMembers = function ({
  hideInvitationModal,
  showMemberInvitationModal,
  teamId,
  token,
  onSettingsOpen,
  ...remainingProps
}: Partial<MemberInvitationModalProps> & {
  hideInvitationModal: () => void;
  showMemberInvitationModal: boolean;
  teamId: number;
  token?: string;
  onSettingsOpen: () => void;
}) {
  const queryParams = useCompatSearchParams();
  const translationData = useLocale();
  const trpcUtils = trpc.useUtils();

  const memberInvitation = trpc.viewer.teams.inviteMember.useMutation();

  const orgMembersQuery = trpc.viewer.organizations.getMembers.useQuery(
    {
      teamIdToExclude: teamId,
      distinctUser: true,
    },
    {
      enabled: queryParams !== null && Boolean(teamId) && Boolean(showMemberInvitationModal),
    }
  );

  return (
    <MemberInvitationModal
      {...remainingProps}
      isPending={memberInvitation.isPending || orgMembersQuery.isPending}
      isOpen={showMemberInvitationModal}
      orgMembers={orgMembersQuery.data}
      teamId={teamId}
      token={token}
      onExit={hideInvitationModal}
      checkMembershipMutation={true}
      onSubmit={function (submittedData, formReset) {
        memberInvitation.mutate(
          {
            teamId,
            language: translationData.i18n.language,
            role: submittedData.role,
            usernameOrEmail: submittedData.emailOrUsername,
          },
          {
            onSuccess: async function (response) {
              await Promise.all([
                trpcUtils.viewer.teams.get.invalidate(),
                trpcUtils.viewer.teams.listMembers.invalidate(),
                trpcUtils.viewer.organizations.getMembers.invalidate(),
              ]);

              hideInvitationModal();

              if (Array.isArray(response.usernameOrEmail)) {
                showToast(
                  translationData.t("email_invite_team_bulk", {
                    userCount: response.numUsersInvited,
                  }),
                  "success"
                );
                formReset();
              } else {
                showToast(
                  translationData.t("email_invite_team", {
                    email: response.usernameOrEmail,
                  }),
                  "success"
                );
              }
            },
            onError: function (errorData) {
              showToast(errorData.message, "error");
            },
          }
        );
      }}
      onSettingsOpen={function () {
        hideInvitationModal();
        onSettingsOpen();
      }}
    />
  );
};
