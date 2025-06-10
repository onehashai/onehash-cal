import { useState } from "react";

import {
  ORG_SELF_SERVE_ENABLED,
  ORG_MINIMUM_PUBLISHED_TEAMS_SELF_SERVE_HELPER_DIALOGUE,
} from "@calcom/lib/constants";
import { trackFormbricksAction } from "@calcom/lib/formbricks-client";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import { Card, Icon, showToast } from "@calcom/ui";

import TeamListItem from "./TeamListItem";

interface Props {
  teams: RouterOutputs["viewer"]["teams"]["list"];
  pending?: boolean;
}

export default function TeamList(properties: Props) {
  const trpcUtils = trpc.useUtils();

  const localeHook = useLocale();
  const currentUserQuery = trpc.viewer.me.useQuery();

  const [dropdownVisibility, setDropdownVisibility] = useState(false);

  const actionHandler = (selectedAction: string, targetTeamId: number) => {
    if (selectedAction === "disband") {
      executeTeamRemoval(targetTeamId);
    }
  };

  const teamDeletionMutation = trpc.viewer.teams.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.viewer.teams.list.invalidate(),
        trpcUtils.viewer.teams.hasTeamPlan.invalidate(),
      ]);
      trackFormbricksAction("team_disbanded");
    },
    onError: async (error) => {
      showToast(error.message, "error");
    },
  });

  const executeTeamRemoval = (targetTeamId: number) => {
    teamDeletionMutation.mutate({ teamId: targetTeamId });
  };

  if (!currentUserQuery.data) return null;

  const userBelongsToOrganization = currentUserQuery.data.profile.organization;

  const renderOrganizationPrompt = () => {
    if (
      !ORG_SELF_SERVE_ENABLED ||
      properties.pending ||
      userBelongsToOrganization ||
      properties.teams.length < ORG_MINIMUM_PUBLISHED_TEAMS_SELF_SERVE_HELPER_DIALOGUE
    ) {
      return null;
    }

    return properties.teams
      .filter((teamItem, index) => teamItem.role !== "MEMBER" && index === 0)
      .map((teamItem) => (
        <div className="bg-subtle p-4" key={teamItem.id}>
          <div className="grid-col-1 grid gap-2 md:grid-cols-3">
            <Card
              icon={<Icon name="building" className="h-5 w-5 text-red-700" />}
              variant="basic"
              title={localeHook.t("You have a lot of teams")}
              description={localeHook.t(
                "Consider consolidating your teams in an organisation, unify billing, admin tools and analytics."
              )}
              actionButton={{
                href: `/settings/organizations/new`,
                child: localeHook.t("set_up_your_organization"),
                "data-testid": "setup_your_org_action_button",
              }}
            />
            <Card
              icon={<Icon name="paintbrush" className="h-5 w-5 text-orange-700" />}
              variant="basic"
              title={localeHook.t("Get a clean subdomain")}
              description={localeHook.t(
                "Right now, team member URLs are all over the place. Get a beautiful link and turn every email address into a scheduling link: anna@acme.com → acme.cal.com/anna"
              )}
              actionButton={{
                href: "https://www.youtube.com/watch?v=G0Jd2dp7064",
                child: localeHook.t("learn_more"),
              }}
            />
            <Card
              icon={<Icon name="chart-line" className="h-5 w-5 text-green-700" />}
              variant="basic"
              title={localeHook.t("Admin tools and analytics")}
              description={localeHook.t(
                "As an organization owner, you are in charge of every team account. You can make changes with admin-only tools and see organization wide analytics in one place."
              )}
              actionButton={{
                href: "https://i.cal.com/sales/enterprise",
                child: localeHook.t("learn_more"),
              }}
            />
          </div>
        </div>
      ));
  };

  const renderRecommendedSteps = () => {
    if (properties.pending || properties.teams.length !== 1) {
      return null;
    }

    return properties.teams
      .filter((teamEntity, position) => teamEntity.role !== "MEMBER" && position === 0)
      .map((teamEntity) => (
        <div className="bg-subtle p-6" key={`listing${teamEntity.id}`}>
          <h3 className="text-emphasis mb-4 text-sm font-semibold">
            {localeHook.t("recommended_next_steps")}
          </h3>
          <div className="grid-col-1 grid gap-2 md:grid-cols-3">
            <Card
              icon={<Icon name="user-plus" className="h-5 w-5 text-green-700" />}
              variant="basic"
              title={localeHook.t("invite_team_member")}
              description={localeHook.t("meetings_are_better_with_the_right")}
              actionButton={{
                href: `/settings/teams/${teamEntity.id}/members`,
                child: localeHook.t("invite"),
              }}
            />
            <Card
              icon={<Icon name="users" className="h-5 w-5 text-orange-700" />}
              variant="basic"
              title={localeHook.t("collective_or_roundrobin")}
              description={localeHook.t("book_your_team_members")}
              actionButton={{
                href: `/event-types?dialog=new&eventPage=team%2F${teamEntity.slug}&teamId=${teamEntity.id}`,
                child: localeHook.t("create"),
              }}
            />
            <Card
              icon={<Icon name="pencil" className="h-5 w-5 text-purple-700" />}
              variant="basic"
              title={localeHook.t("appearance")}
              description={localeHook.t("appearance_description")}
              actionButton={{
                href: `/settings/teams/${teamEntity.id}/appearance`,
                child: localeHook.t("edit"),
              }}
            />
          </div>
        </div>
      ));
  };

  return (
    <ul className="bg-default divide-subtle border-subtle mb-2 divide-y overflow-hidden rounded-md border">
      {renderOrganizationPrompt()}
      {properties.teams.map((teamData) => (
        <TeamListItem
          key={teamData?.id as number}
          team={teamData}
          onActionSelect={(actionType: string) => actionHandler(actionType, teamData?.id as number)}
          isPending={teamDeletionMutation.isPending}
          hideDropdown={dropdownVisibility}
          setHideDropdown={setDropdownVisibility}
        />
      ))}
      {renderRecommendedSteps()}
    </ul>
  );
}
