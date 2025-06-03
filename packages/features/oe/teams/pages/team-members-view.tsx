"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useParamsWithFallback } from "@calcom/lib/hooks/useParamsWithFallback";
import { MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";

import DisableTeamImpersonation from "../components/DisableTeamImpersonation";
import InviteLinkSettingsModal from "../components/InviteLinkSettingsModal";
import MakeTeamPrivateSwitch from "../components/MakeTeamPrivateSwitch";
import { MemberInvitationModalWithoutMembers } from "../components/MemberInvitationModal";
import MemberList from "../components/MemberList";
import TeamInviteList from "../components/TeamInviteList";

const MembersView = () => {
  const { t } = useLocale();
  const [memberInviteModalVisible, setMemberInviteModalVisible] = useState(false);
  const [inviteLinkConfigModalVisible, setInviteLinkConfigModalVisible] = useState(false);
  const navigationRouter = useRouter();
  const currentSession = useSession();
  const organizationContext = currentSession?.data?.user.org;
  const routeParams = useParamsWithFallback();

  const extractedTeamId = Number(routeParams.id);

  const {
    data: teamDetails,
    isPending: teamDataLoading,
    error: teamFetchError,
  } = trpc.viewer.teams.get.useQuery(
    { teamId: extractedTeamId },
    {
      enabled: !!extractedTeamId,
    }
  );
  useEffect(
    function handleErrorRedirect() {
      if (teamFetchError) {
        navigationRouter.replace("/teams");
      }
    },
    [teamFetchError]
  );

  const isDataLoading = teamDataLoading;

  const pendingInvitationExists = !teamDetails?.membership.accepted;

  const hasAdministrativeRights =
    teamDetails &&
    (teamDetails.membership.role === MembershipRole.OWNER ||
      teamDetails.membership.role === MembershipRole.ADMIN);

  const isOrganizationAdministrator =
    organizationContext?.role === MembershipRole.OWNER || organizationContext?.role === MembershipRole.ADMIN;

  const closeMemberInviteModal = () => {
    setMemberInviteModalVisible(false);
  };

  return (
    <>
      {!isDataLoading && (
        <>
          <div>
            {teamDetails && (
              <>
                {pendingInvitationExists && (
                  <TeamInviteList
                    teams={[
                      {
                        id: teamDetails.id,
                        accepted: teamDetails.membership.accepted || false,
                        name: teamDetails.name,
                        slug: teamDetails.slug,
                        role: teamDetails.membership.role,
                      },
                    ]}
                  />
                )}
              </>
            )}

            {((teamDetails?.isPrivate && hasAdministrativeRights) ||
              !teamDetails?.isPrivate ||
              isOrganizationAdministrator) &&
              teamDetails && (
                <div className="mb-6">
                  <MemberList
                    team={teamDetails}
                    isOrgAdminOrOwner={isOrganizationAdministrator}
                    setShowMemberInvitationModal={setMemberInviteModalVisible}
                  />
                </div>
              )}
            {memberInviteModalVisible && teamDetails && teamDetails.id && (
              <MemberInvitationModalWithoutMembers
                hideInvitationModal={closeMemberInviteModal}
                showMemberInvitationModal={memberInviteModalVisible}
                teamId={teamDetails.id}
                token={teamDetails.inviteToken?.token}
                onSettingsOpen={() => setInviteLinkConfigModalVisible(true)}
              />
            )}

            {inviteLinkConfigModalVisible && teamDetails?.inviteToken && teamDetails.id && (
              <InviteLinkSettingsModal
                isOpen={inviteLinkConfigModalVisible}
                teamId={teamDetails.id}
                token={teamDetails.inviteToken.token}
                expiresInDays={teamDetails.inviteToken.expiresInDays || undefined}
                onExit={() => {
                  setInviteLinkConfigModalVisible(false);
                  setMemberInviteModalVisible(true);
                }}
              />
            )}

            {teamDetails && currentSession.data && (
              <DisableTeamImpersonation
                teamId={teamDetails.id}
                memberId={currentSession.data.user.id}
                disabled={pendingInvitationExists}
              />
            )}

            {teamDetails && teamDetails.id && (hasAdministrativeRights || isOrganizationAdministrator) && (
              <MakeTeamPrivateSwitch
                isOrg={false}
                teamId={teamDetails.id}
                isPrivate={teamDetails.isPrivate ?? false}
                disabled={pendingInvitationExists}
              />
            )}
          </div>
        </>
      )}
    </>
  );
};

export default MembersView;
