import { zodResolver } from "@hookform/resolvers/zod";
import type { Dispatch } from "react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { shallow } from "zustand/shallow";

import { DisplayInfo } from "@calcom/features/users/components/UserTable/EditSheet/DisplayInfo";
import { SheetFooterControls } from "@calcom/features/users/components/UserTable/EditSheet/SheetFooterControls";
import { useEditMode } from "@calcom/features/users/components/UserTable/EditSheet/store";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import {
  Avatar,
  Icon,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetBody,
  Skeleton,
  Tooltip,
  ToggleGroup,
  Form,
  showToast,
  Loader,
} from "@calcom/ui";

import { updateRoleInCache } from "./MemberChangeRoleModal";
import type { Action, State, User } from "./MemberList";

const membershipValidationSchema = z.object({
  role: z.enum([MembershipRole.MEMBER, MembershipRole.ADMIN, MembershipRole.OWNER]),
});

type RoleFormData = z.infer<typeof membershipValidationSchema>;

const extractUserDisplayName = (userData: User): string => {
  if (userData.name) return userData.name;

  const emailPrefix = userData.email.split("@")[0] as string;
  return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
};

const generateBookingUrl = (baseUrl: string, username?: string): string => {
  const sanitizedUrl = baseUrl.replace(/^https?:\/\//, "");
  return username ? `${sanitizedUrl}/${username}` : "";
};

export function EditMemberSheet({
  state,
  dispatch,
  currentMember,
  teamId,
}: {
  state: State;
  dispatch: Dispatch<Action>;
  currentMember: MembershipRole;
  teamId: number;
}) {
  const { t } = useLocale();
  const selectedUserData = state.editSheet.user as User;
  const [editMode, setEditMode, setMutationLoading] = useEditMode(
    (state) => [state.editMode, state.setEditMode, state.setMutationLoading],
    shallow
  );

  const [currentRole, updateCurrentRole] = useState(selectedUserData.role);
  const displayName = extractUserDisplayName(selectedUserData);
  const profileUrl = selectedUserData.username
    ? generateBookingUrl(selectedUserData.bookerUrl, selectedUserData.username)
    : "";
  const trpcUtils = trpc.useUtils();

  const roleSelectionOptions = useMemo(() => {
    const baseOptions = [
      { label: t("member"), value: MembershipRole.MEMBER },
      { label: t("admin"), value: MembershipRole.ADMIN },
      { label: t("owner"), value: MembershipRole.OWNER },
    ];

    return baseOptions.filter(({ value }) => {
      return value !== MembershipRole.OWNER || currentMember === MembershipRole.OWNER;
    });
  }, [t, currentMember]);

  const roleManagementForm = useForm({
    resolver: zodResolver(membershipValidationSchema),
    defaultValues: { role: selectedUserData.role },
  });

  const { data: userApplicationsData, isPending: isApplicationsLoading } =
    trpc.viewer.teams.getUserConnectedApps.useQuery({
      userIds: [selectedUserData.id],
      teamId,
    });

  const userConnectedApps = userApplicationsData?.[selectedUserData.id];

  const roleMutationHandler = trpc.viewer.teams.changeMemberRole.useMutation({
    onMutate: async ({ teamId, memberId, role }) => {
      await trpcUtils.viewer.teams.listMembers.cancel();
      const cachedData = trpcUtils.viewer.teams.listMembers.getInfiniteData({
        limit: 10,
        teamId,
        searchTerm: undefined,
      });

      if (cachedData) {
        updateRoleInCache({ utils: trpcUtils, teamId, memberId, role, searchTerm: undefined });
      }

      return { previousValue: cachedData };
    },
    onSuccess: async (_response, { role }) => {
      updateCurrentRole(role);
      setMutationLoading(false);
      await trpcUtils.viewer.teams.get.invalidate();
      await trpcUtils.viewer.organizations.listMembers.invalidate();
      showToast(t("profile_updated_successfully"), "success");
      setEditMode(false);
    },
    async onError(error) {
      showToast(error.message, "error");
      setMutationLoading(false);
    },
  });

  const handleRoleUpdate = (formData: RoleFormData) => {
    setMutationLoading(true);
    roleMutationHandler.mutate({
      teamId: teamId,
      memberId: selectedUserData.id,
      role: formData.role,
    });
  };

  const renderConnectedApplications = (applications: typeof userConnectedApps) => {
    return applications
      ? applications.map(({ logo, name, externalId }) => {
          if (!logo) return null;

          const imageElement = <img className="h-5 w-5" src={logo} alt={`${name} logo`} />;
          const containerClass = "ltr:mr-2 rtl:ml-2";

          return externalId ? (
            <div className={containerClass} key={name}>
              <Tooltip content={externalId}>{imageElement}</Tooltip>
            </div>
          ) : (
            <div className={containerClass} key={name}>
              {imageElement}
            </div>
          );
        })
      : [];
  };

  const applicationsList = renderConnectedApplications(userConnectedApps);

  const closeSheetHandler = () => {
    setEditMode(false);
    dispatch({ type: "CLOSE_MODAL" });
  };

  const renderProfileHeader = () => (
    <div className="border-sublte bg-default w-full rounded-xl border p-4">
      <div
        className="block w-full rounded-lg ring-1 ring-[#0000000F]"
        style={{
          background: "linear-gradient(to top right, var(--cal-bg-emphasis), var(--cal-bg))",
          height: "110px",
        }}
      />
      <div className="bg-default ml-3 w-fit translate-y-[-50%] rounded-full p-1 ring-1 ring-[#0000000F]">
        <Avatar asChild size="lg" alt={`${displayName} avatar`} imageSrc={selectedUserData.avatarUrl} />
      </div>
      <Skeleton as="p" waitForTranslation={false}>
        <h2 className="text-emphasis font-sans text-2xl font-semibold">{displayName || "Nameless User"}</h2>
      </Skeleton>
      <Skeleton as="p" waitForTranslation={false}>
        <p className="text-subtle max-h-[3em] overflow-hidden text-ellipsis text-sm font-normal">
          {selectedUserData.bio || t("user_has_no_bio")}
        </p>
      </Skeleton>
    </div>
  );

  const renderRoleControl = () => {
    if (!editMode) {
      return <DisplayInfo label={t("role")} value={[currentRole]} icon="fingerprint" />;
    }

    return (
      <div className="flex items-center gap-6">
        <div className="flex w-[110px] items-center gap-2">
          <Icon className="h-4 w-4" name="fingerprint" />
          <label className="text-sm font-medium">{t("role")}</label>
        </div>
        <div className="flex flex-1">
          <ToggleGroup
            isFullWidth
            defaultValue={currentRole}
            value={roleManagementForm.watch("role")}
            options={roleSelectionOptions}
            onValueChange={(selectedValue: RoleFormData["role"]) => {
              roleManagementForm.setValue("role", selectedValue);
            }}
          />
        </div>
      </div>
    );
  };

  const renderApplicationsSection = () => (
    <div className="flex items-center gap-6">
      <div className="flex w-[110px] items-center gap-2">
        <Icon className="text-subtle h-4 w-4" name="grid-3x3" />
        <label className="text-subtle text-sm font-medium">{t("apps")}</label>
      </div>
      <div className="flex flex-1">
        {!userConnectedApps ? (
          <div>{t("user_has_no_app_installed")}</div>
        ) : (
          <div className="flex">{applicationsList}</div>
        )}
      </div>
    </div>
  );

  return (
    <Sheet open={true} onOpenChange={closeSheetHandler}>
      <SheetContent className="bg-muted">
        {!isApplicationsLoading ? (
          <Form form={roleManagementForm} handleSubmit={handleRoleUpdate} className="flex h-full flex-col">
            <SheetHeader showCloseButton={false} className="w-full">
              {renderProfileHeader()}
            </SheetHeader>
            <SheetBody className="flex flex-col space-y-4 p-4">
              <div className="mb-4 flex flex-col space-y-4">
                <h3 className="text-emphasis mb-1 text-base font-semibold">{t("profile")}</h3>
                <DisplayInfo label="Cal" value={profileUrl} icon="external-link" />
                <DisplayInfo label={t("email")} value={selectedUserData.email} icon="at-sign" />
                {renderRoleControl()}
                {renderApplicationsSection()}
              </div>
            </SheetBody>
            <SheetFooter className="mt-auto">
              <SheetFooterControls />
            </SheetFooter>
          </Form>
        ) : (
          <Loader />
        )}
      </SheetContent>
    </Sheet>
  );
}
