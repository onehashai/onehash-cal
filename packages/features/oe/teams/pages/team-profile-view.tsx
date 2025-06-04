"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Prisma } from "@prisma/client";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import SectionBottomActions from "@calcom/features/settings/SectionBottomActions";
import { IS_TEAM_BILLING_ENABLED, WEBAPP_URL } from "@calcom/lib/constants";
import { getPlaceholderAvatar } from "@calcom/lib/defaultAvatarImage";
import { trackFormbricksAction } from "@calcom/lib/formbricks-client";
import { getTeamUrlSync } from "@calcom/lib/getBookerUrl/client";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useParamsWithFallback } from "@calcom/lib/hooks/useParamsWithFallback";
import { md } from "@calcom/lib/markdownIt";
import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";
import objectKeys from "@calcom/lib/objectKeys";
import slugify from "@calcom/lib/slugify";
import turndown from "@calcom/lib/turndownService";
import { MembershipRole } from "@calcom/prisma/enums";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import {
  Avatar,
  Button,
  ConfirmationDialogContent,
  Dialog,
  DialogTrigger,
  Editor,
  Form,
  ImageUploader,
  Label,
  LinkIconButton,
  showToast,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonContainer,
  SkeletonText,
  TextField,
} from "@calcom/ui";

const urlPattern = new RegExp("^[a-zA-Z0-9-]*$");

const teamConfigValidationSchema = z.object({
  name: z.string(),
  slug: z
    .string()
    .regex(urlPattern, {
      message: "Url can only have alphanumeric characters(a-z, 0-9) and hyphen(-) symbol.",
    })
    .min(1, { message: "Url cannot be left empty" }),
  logo: z.string().nullable(),
  bio: z.string(),
});

type TeamFormData = z.infer<typeof teamConfigValidationSchema>;

const LoadingSkeletonComponent = () => {
  return (
    <SkeletonContainer>
      <div className="border-subtle space-y-6 rounded-b-xl border border-t-0 px-4 py-8">
        <div className="flex items-center">
          <SkeletonAvatar className="me-4 mt-0 h-16 w-16 px-4" />
          <SkeletonButton className="h-6 w-32 rounded-md p-5" />
        </div>
        <SkeletonText className="h-8 w-full" />
        <SkeletonText className="h-8 w-full" />
        <SkeletonText className="h-8 w-full" />

        <SkeletonButton className="mr-6 h-8 w-20 rounded-md p-5" />
      </div>
    </SkeletonContainer>
  );
};

const ProfileView = () => {
  const routeParameters = useParamsWithFallback();
  const teamIdentifier = Number(routeParameters.id);
  const { t } = useLocale();
  const navigationRouter = useRouter();
  const trpcUtilities = trpc.useUtils();
  const userSession = useSession();

  useLayoutEffect(() => {
    document.body.focus();
  }, []);

  const {
    data: teamData,
    isPending: isLoadingTeam,
    error: teamQueryError,
  } = trpc.viewer.teams.get.useQuery(
    { teamId: teamIdentifier },
    {
      enabled: !!teamIdentifier,
    }
  );

  useEffect(
    function redirectOnErrorCondition() {
      if (teamQueryError) {
        navigationRouter.replace("/teams");
      }
    },
    [teamQueryError]
  );
  const hasAdminAccess =
    teamData &&
    (teamData.membership.role === MembershipRole.OWNER || teamData.membership.role === MembershipRole.ADMIN);

  const teamUrlPath = teamData
    ? `${getTeamUrlSync({
        orgSlug: teamData.parent ? teamData.parent.slug : null,
        teamSlug: teamData.slug,
      })}`
    : "";

  const bioContentEmpty = !teamData || !teamData.bio || !teamData.bio.replace("<p><br></p>", "").length;

  const teamDeletionMutation = trpc.viewer.teams.delete.useMutation({
    async onSuccess() {
      await trpcUtilities.viewer.teams.list.invalidate();
      await trpcUtilities.viewer.eventTypes.getByViewer.invalidate();
      showToast(t("your_team_disbanded_successfully"), "success");
      navigationRouter.push(`${WEBAPP_URL}/teams`);
      trackFormbricksAction("team_disbanded");
    },
  });

  const memberRemovalMutation = trpc.viewer.teams.removeMember.useMutation({
    async onSuccess() {
      await trpcUtilities.viewer.teams.get.invalidate();
      await trpcUtilities.viewer.teams.list.invalidate();
      await trpcUtilities.viewer.eventTypes.invalidate();
      showToast(t("success"), "success");
    },
    async onError(errorResponse) {
      showToast(errorResponse.message, "error");
    },
  });

  function executeTeamDeletion() {
    if (teamData?.id) teamDeletionMutation.mutate({ teamId: teamData.id });
  }

  function performTeamExit() {
    if (teamData?.id && userSession.data)
      memberRemovalMutation.mutate({
        teamIds: [teamData.id],
        memberIds: [userSession.data.user.id],
      });
  }

  if (isLoadingTeam) {
    return <LoadingSkeletonComponent />;
  }

  return (
    <>
      {hasAdminAccess ? (
        <TeamConfigurationForm team={teamData} />
      ) : (
        <div className="border-subtle flex rounded-b-xl border border-t-0 px-4 py-8 sm:px-6">
          <div className="flex-grow">
            <div>
              <Label className="text-emphasis">{t("team_name")}</Label>
              <p className="text-default text-sm">{teamData?.name}</p>
            </div>
            {teamData && !bioContentEmpty && (
              <>
                <Label className="text-emphasis mt-5">{t("about")}</Label>
                <div
                  className="  text-subtle break-words text-sm [&_a]:text-blue-500 [&_a]:underline [&_a]:hover:text-blue-600"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: markdownToSafeHTML(teamData.bio ?? null) }}
                />
              </>
            )}
          </div>
          <div>
            <Link href={teamUrlPath} passHref={true} target="_blank">
              <LinkIconButton Icon="external-link">{t("preview")}</LinkIconButton>
            </Link>
            <LinkIconButton
              Icon="link"
              onClick={() => {
                navigator.clipboard.writeText(teamUrlPath);
                showToast("Copied to clipboard", "success");
              }}>
              {t("copy_link_team")}
            </LinkIconButton>
          </div>
        </div>
      )}

      <div className="border-subtle mt-6 rounded-lg rounded-b-none border border-b-0 p-6">
        <Label className="mb-0 text-base font-semibold text-red-700">{t("danger_zone")}</Label>
        {teamData?.membership.role === "OWNER" && (
          <p className="text-subtle text-sm">{t("team_deletion_cannot_be_undone")}</p>
        )}
      </div>
      {teamData?.membership.role === "OWNER" ? (
        <Dialog>
          <SectionBottomActions align="end">
            <DialogTrigger asChild>
              <Button
                color="destructive"
                className="border"
                StartIcon="trash-2"
                data-testid="disband-team-button">
                {t("disband_team")}
              </Button>
            </DialogTrigger>
          </SectionBottomActions>
          <ConfirmationDialogContent
            variety="danger"
            title={t("disband_team")}
            confirmBtnText={t("confirm_disband_team")}
            onConfirm={() => {
              executeTeamDeletion();
            }}>
            {t("disband_team_confirmation_message")}
          </ConfirmationDialogContent>
        </Dialog>
      ) : (
        <Dialog>
          <SectionBottomActions align="end">
            <DialogTrigger asChild>
              <Button color="destructive" className="border" StartIcon="log-out">
                {t("leave_team")}
              </Button>
            </DialogTrigger>
          </SectionBottomActions>
          <ConfirmationDialogContent
            variety="danger"
            title={t("leave_team")}
            confirmBtnText={t("confirm_leave_team")}
            onConfirm={performTeamExit}>
            {t("leave_team_confirmation_message")}
          </ConfirmationDialogContent>
        </Dialog>
      )}
    </>
  );
};

export type TeamProfileFormProps = { team: RouterOutputs["viewer"]["teams"]["get"] };

const TeamConfigurationForm = ({ team }: TeamProfileFormProps) => {
  const trpcUtilities = trpc.useUtils();
  const { t } = useLocale();
  const navigationRouter = useRouter();

  const updateTeamMutation = trpc.viewer.teams.update.useMutation({
    onError: (errorResponse) => {
      showToast(errorResponse.message, "error");
    },
    async onSuccess(responseData) {
      resetFormValues({
        logo: responseData?.logoUrl,
        name: (responseData?.name || "") as string,
        bio: (responseData?.bio || "") as string,
        slug: responseData?.slug as string,
      });
      await trpcUtilities.viewer.teams.get.invalidate();
      await trpcUtilities.viewer.teams.list.invalidate();
      showToast(t("your_team_updated_successfully"), "success");
    },
  });

  const initialFormValues: TeamFormData = {
    name: team?.name || "",
    logo: team?.logo || "",
    bio: team?.bio || "",
    slug: team?.slug || ((team?.metadata as Prisma.JsonObject)?.requestedSlug as string) || "",
  };

  const formController = useForm({
    defaultValues: initialFormValues,
    resolver: zodResolver(teamConfigValidationSchema),
  });

  const [initialRenderState, setInitialRenderState] = useState(true);

  const {
    formState: { isSubmitting, isDirty },
    reset: resetFormValues,
  } = formController;

  const isFormDisabled = isSubmitting || !isDirty;

  const teamPublishMutation = trpc.viewer.teams.publish.useMutation({
    async onSuccess(responseData: { url?: string }) {
      if (responseData.url) {
        navigationRouter.push(responseData.url);
      }
    },
    async onError(errorResponse) {
      showToast(errorResponse.message, "error");
    },
  });

  return (
    <Form
      form={formController}
      handleSubmit={(formValues) => {
        if (team) {
          const updatePayload = {
            name: formValues.name,
            slug: formValues.slug,
            bio: formValues.bio,
            logo: formValues.logo,
          };
          objectKeys(updatePayload).forEach((propertyKey) => {
            if (updatePayload[propertyKey as keyof typeof updatePayload] === team?.[propertyKey])
              delete updatePayload[propertyKey];
          });
          updateTeamMutation.mutate({ id: team.id, ...updatePayload });
        }
      }}>
      <div className="border-subtle border-x px-4 py-8 sm:px-6">
        {!team.parent && (
          <div className="flex items-center pb-8">
            <Controller
              control={formController.control}
              name="logo"
              render={({ field: { value: logoValue, onChange: handleLogoChange } }) => {
                const shouldShowRemoveButton = !!logoValue;

                return (
                  <>
                    <Avatar
                      alt={formController.getValues("name")}
                      data-testid="profile-upload-logo"
                      imageSrc={getPlaceholderAvatar(logoValue, formController.getValues("name"))}
                      size="lg"
                    />
                    <div className="ms-4 flex gap-2">
                      <ImageUploader
                        target="logo"
                        id="avatar-upload"
                        buttonMsg={t("upload_logo")}
                        handleAvatarChange={handleLogoChange}
                        triggerButtonColor={shouldShowRemoveButton ? "secondary" : "primary"}
                        imageSrc={getPlaceholderAvatar(logoValue, formController.getValues("name"))}
                      />
                      {shouldShowRemoveButton && (
                        <Button color="secondary" onClick={() => handleLogoChange(null)}>
                          {t("remove")}
                        </Button>
                      )}
                    </div>
                  </>
                );
              }}
            />
          </div>
        )}

        <Controller
          control={formController.control}
          name="name"
          render={({ field: { name: fieldName, value: fieldValue, onChange: handleFieldChange } }) => (
            <TextField
              name={fieldName}
              label={t("team_name")}
              value={fieldValue}
              onChange={(eventTarget) => handleFieldChange(eventTarget?.target.value)}
            />
          )}
        />
        <Controller
          control={formController.control}
          name="slug"
          render={({ field: { value: slugValue } }) => (
            <div className="mt-8">
              <TextField
                name="slug"
                label={t("team_url")}
                value={slugValue}
                data-testid="team-url"
                addOnClassname="testid-leading-text-team-url"
                addOnLeading={`${getTeamUrlSync(
                  { orgSlug: team.parent ? team.parent.slug : null, teamSlug: null },
                  {
                    protocol: false,
                  }
                )}`}
                onChange={(eventTarget) => {
                  formController.clearErrors("slug");
                  formController.setValue("slug", slugify(eventTarget?.target.value, true), {
                    shouldDirty: true,
                  });
                }}
              />
            </div>
          )}
        />
        <div className="mt-8">
          <Label>{t("about")}</Label>
          <Editor
            getText={() => md.render(formController.getValues("bio") || "")}
            setText={(editorValue: string) =>
              formController.setValue("bio", turndown(editorValue), { shouldDirty: true })
            }
            excludedToolbarItems={["blockType"]}
            disableLists
            firstRender={initialRenderState}
            setFirstRender={setInitialRenderState}
            height="80px"
          />
        </div>
        <p className="text-default mt-2 text-sm">{t("team_description")}</p>
      </div>
      <SectionBottomActions align="end">
        <Button
          color="primary"
          type="submit"
          loading={updateTeamMutation.isPending}
          disabled={isFormDisabled}>
          {t("update")}
        </Button>
        {IS_TEAM_BILLING_ENABLED &&
          team.slug === null &&
          (team.metadata as Prisma.JsonObject)?.requestedSlug && (
            <Button
              color="secondary"
              className="ml-2"
              type="button"
              onClick={() => {
                teamPublishMutation.mutate({ teamId: team.id });
              }}>
              {t("team_publish")}
            </Button>
          )}
      </SectionBottomActions>
    </Form>
  );
};

export default ProfileView;
