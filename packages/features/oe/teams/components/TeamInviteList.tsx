import { useState } from "react";

import { trackFormbricksAction } from "@calcom/lib/formbricks-client";
import type { MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import { showToast } from "@calcom/ui";

import TeamInviteListItem from "./TeamInviteListItem";

interface Props {
  teams: {
    id?: number;
    name?: string | null;
    slug?: string | null;
    bio?: string | null;
    hideBranding?: boolean | undefined;
    role: MembershipRole;
    logoUrl?: string | null;
    accepted: boolean;
  }[];
}

const TeamInviteList = function (properties: Props) {
  const trpcUtilities = trpc.useUtils();

  const [dropdownVisibility, updateDropdownVisibility] = useState(false);

  const teamDeletionMutation = trpc.viewer.teams.delete.useMutation({
    onSuccess: async function () {
      await Promise.all([
        trpcUtilities.viewer.teams.list.invalidate(),
        trpcUtilities.viewer.teams.get.invalidate(),
        trpcUtilities.viewer.organizations.listMembers.invalidate(),
      ]);
      trackFormbricksAction("team_disbanded");
    },
    onError: async function (errorData) {
      showToast(errorData.message, "error");
    },
  });

  const executeTeamDeletion = function (targetTeamId: number) {
    teamDeletionMutation.mutate({ teamId: targetTeamId });
  };

  const handleActionSelection = function (selectedAction: string, teamIdentifier: number) {
    if (selectedAction === "disband") {
      executeTeamDeletion(teamIdentifier);
    }
  };

  const renderTeamItem = function (teamData: Props["teams"][0]) {
    const teamId = teamData.id;
    if (typeof teamId !== "number") return null;

    return (
      <TeamInviteListItem
        key={teamId}
        team={teamData}
        onActionSelect={function (actionType: string) {
          handleActionSelection(actionType, teamId);
        }}
        isPending={teamDeletionMutation.isPending}
        hideDropdown={dropdownVisibility}
        setHideDropdown={updateDropdownVisibility}
      />
    );
  };

  const listElements = properties.teams.map(function (individualTeam) {
    return renderTeamItem(individualTeam);
  });

  const containerElement = (
    <div>
      <ul className="bg-default divide-subtle mb-8 divide-y rounded">{listElements}</ul>
    </div>
  );

  return containerElement;
};

export default TeamInviteList;
