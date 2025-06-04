import { keepPreviousData } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

import { useOrgBranding } from "@calcom/features/oe/organizations/context/provider";
import InviteLinkSettingsModal from "@calcom/features/oe/teams/components/InviteLinkSettingsModal";
import { MemberInvitationModalWithoutMembers } from "@calcom/features/oe/teams/components/MemberInvitationModal";
import { classNames } from "@calcom/lib";
import { APP_NAME } from "@calcom/lib/constants";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { telemetryEventTypes, useTelemetry } from "@calcom/lib/telemetry";
import { MembershipRole } from "@calcom/prisma/enums";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import {
  Badge,
  Button,
  showToast,
  SkeletonButton,
  SkeletonContainer,
  SkeletonText,
  UserAvatar,
} from "@calcom/ui";

type MemberData = RouterOutputs["viewer"]["teams"]["listMembers"]["members"][number];

const TeamMemberAddition = ({ isOrg = false }: { isOrg?: boolean }) => {
  const queryParams = useCompatSearchParams();
  const userSession = useSession();
  const analytics = useTelemetry();

  const organizationId = queryParams?.get("id") ? Number(queryParams.get("id")) : -1;
  const organizationQuery = trpc.viewer.teams.get.useQuery(
    { teamId: organizationId, isOrg },
    { enabled: userSession.status === "authenticated" }
  );

  useEffect(() => {
    const eventType = queryParams?.get("event");
    if (eventType === "team_created") {
      analytics.event(telemetryEventTypes.team_created);
    }
  }, []);

  if (userSession.status === "loading" || !organizationQuery.data) return <TeamMemberSkeletonLoader />;

  return <TeamMemberForm teamId={organizationId} isOrg={isOrg} />;
};

export const TeamMemberForm = ({ teamId, isOrg }: { teamId: number; isOrg?: boolean }) => {
  const urlParams = useCompatSearchParams();
  const { t } = useLocale();

  const navigation = useRouter();
  const brandingConfig = useOrgBranding();

  const modalVisible = urlParams?.get("inviteModal") === "true";
  const [inviteModalState, setInviteModalState] = useState(modalVisible);
  const [linkSettingsModal, setLinkSettingsModal] = useState(false);

  const { data: organization, isPending: isLoading } = trpc.viewer.teams.get.useQuery(
    { teamId, isOrg },
    { enabled: !!teamId }
  );
  const { data: availableOrgMembers } = trpc.viewer.organizations.getMembers.useQuery(
    {
      teamIdToExclude: teamId,
      distinctUser: true,
    },
    {
      enabled: brandingConfig !== null,
    }
  );

  const {
    data: memberData,
    fetchNextPage: loadMoreMembers,
    isFetchingNextPage: isLoadingMore,
    hasNextPage: moreAvailable,
  } = trpc.viewer.teams.listMembers.useInfiniteQuery(
    {
      limit: 10,
      teamId,
    },
    {
      enabled: !!teamId,
      getNextPageParam: (lastResult) => lastResult.nextCursor,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0,
    }
  );

  const consolidatedData = useMemo(
    () => memberData?.pages?.flatMap((page) => page.members) ?? [],
    [memberData]
  ) as MemberData[];
  const memberCount = consolidatedData.length;

  const teamPublishMutation = trpc.viewer.teams.publish.useMutation({
    onSuccess(result) {
      navigation.push(result.url);
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  return (
    <>
      <div>
        <ul className="border-subtle rounded-md border" data-testid="pending-member-list">
          {consolidatedData.map((memberInfo, idx) => (
            <MemberListItem
              key={memberInfo.email}
              member={memberInfo}
              index={idx}
              teamId={teamId}
              isOrg={isOrg}
            />
          ))}
        </ul>
        {memberCount && (
          <div className="text-default text-center">
            <Button
              color="minimal"
              loading={isLoadingMore}
              disabled={!moreAvailable}
              onClick={() => loadMoreMembers()}>
              {moreAvailable ? t("load_more_results") : t("no_more_results")}
            </Button>
          </div>
        )}
        <Button
          color="secondary"
          data-testid="new-member-button"
          StartIcon="plus"
          onClick={() => setInviteModalState(true)}
          className={classNames("w-full justify-center", memberCount > 0 && "mt-6")}>
          {isOrg ? t("add_org_members") : t("add_team_member")}
        </Button>
      </div>
      {isLoading ? (
        <SkeletonButton />
      ) : (
        <>
          <MemberInvitationModalWithoutMembers
            showMemberInvitationModal={inviteModalState}
            orgMembers={availableOrgMembers}
            teamId={teamId}
            token={organization?.inviteToken?.token}
            hideInvitationModal={() => setInviteModalState(false)}
            onSettingsOpen={() => {
              setInviteModalState(false);
              setLinkSettingsModal(true);
            }}
          />
          {organization?.inviteToken && (
            <InviteLinkSettingsModal
              isOpen={linkSettingsModal}
              teamId={organization.id}
              token={organization.inviteToken?.token}
              expiresInDays={organization.inviteToken?.expiresInDays || undefined}
              onExit={() => {
                setLinkSettingsModal(false);
                setInviteModalState(true);
              }}
            />
          )}
        </>
      )}
      <hr className="border-subtle my-6" />
      <Button
        data-testid="publish-button"
        EndIcon={!brandingConfig || isOrg ? "arrow-right" : undefined}
        color="primary"
        className="w-full justify-center"
        disabled={teamPublishMutation.isPending}
        onClick={() => {
          let destination = `/settings/teams/${teamId}/event-type`;
          if (isOrg) {
            destination = `/settings/organizations/${teamId}/add-teams`;
          }
          navigation.push(destination);
        }}>
        {t("continue")}
      </Button>
    </>
  );
};

export default TeamMemberAddition;

const TeamMemberSkeletonLoader = () => {
  return (
    <SkeletonContainer className="border-subtle rounded-md border">
      <div className="flex w-full justify-between p-4">
        <div>
          <p className="text-emphasis text-sm font-medium">
            <SkeletonText className="h-4 w-56" />
          </p>
          <div className="mt-2.5 w-max">
            <SkeletonText className="h-5 w-28" />
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
};

const MemberListItem = (properties: {
  member: MemberData;
  index: number;
  teamId: number;
  isOrg?: boolean;
}) => {
  const { member: memberDetails, index: position, teamId: organizationId } = properties;
  const { t } = useLocale();
  const trpcUtils = trpc.useUtils();
  const currentSession = useSession();
  const organizationRole = currentSession?.data?.user.org?.role;
  const profileUrl = memberDetails.bookerUrl;
  const memberRemovalMutation = trpc.viewer.teams.removeMember.useMutation({
    async onSuccess() {
      await trpcUtils.viewer.teams.get.invalidate();
      await trpcUtils.viewer.teams.listMembers.invalidate();
      await trpcUtils.viewer.eventTypes.invalidate();
      showToast(t("member_removed"), "success");
    },
    async onError(error) {
      showToast(error.message, "error");
    },
  });

  const hasAdminPrivileges =
    organizationRole === MembershipRole.OWNER || organizationRole === MembershipRole.ADMIN;

  return (
    <li
      key={memberDetails.email}
      className={classNames(
        "flex items-center justify-between p-6 text-sm",
        position !== 0 && "border-subtle border-t"
      )}
      data-testid="pending-member-item">
      <div className="mr-4 flex max-w-full space-x-2 overflow-hidden rtl:space-x-reverse">
        <UserAvatar size="mdLg" user={memberDetails} />
        <div className="max-w-full overflow-hidden">
          <div className="flex space-x-1">
            <p>{memberDetails.name || memberDetails.email || t("team_member")}</p>
            {memberDetails.id === currentSession.data?.user.id && <Badge variant="green">{t("you")}</Badge>}
            {!memberDetails.accepted && <Badge variant="orange">{t("pending")}</Badge>}
            {memberDetails.role === MembershipRole.MEMBER && <Badge variant="gray">{t("member")}</Badge>}

            {memberDetails.role === MembershipRole.ADMIN && <Badge variant="gray">{t("admin")}</Badge>}
            {memberDetails.role === MembershipRole.OWNER && <Badge variant="gray">{t("owner")}</Badge>}
          </div>
          {memberDetails.username ? (
            <p className="text-default truncate">{`${profileUrl}/${memberDetails.username}`}</p>
          ) : (
            <p className="text-default truncate">{t("not_on_cal", { appName: APP_NAME })}</p>
          )}
        </div>
      </div>
      {(memberDetails.role !== "OWNER" || hasAdminPrivileges) &&
        memberDetails.id !== currentSession.data?.user.id && (
          <Button
            data-testid="remove-member-button"
            StartIcon="trash-2"
            variant="icon"
            color="secondary"
            className="h-[36px] w-[36px]"
            onClick={() => {
              memberRemovalMutation.mutate({
                teamIds: [organizationId],
                memberIds: [memberDetails.id],
                isOrg: !!properties.isOrg,
              });
            }}
          />
        )}
    </li>
  );
};
