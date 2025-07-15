import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/oe-features/ui";
import { useSession } from "next-auth/react";

import { filterQuerySchema } from "@calcom/features/filters/lib/getTeamsFiltersFromQuery";
import { getOrgOrTeamAvatar } from "@calcom/lib/defaultAvatarImage";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useTypedQuery } from "@calcom/lib/hooks/useTypedQuery";
import { trpc } from "@calcom/trpc/react";
import { Avatar, Icon, VerticalDivider } from "@calcom/ui";

function useFilterQuery() {
  // passthrough allows additional params to not be removed
  return useTypedQuery(filterQuerySchema.passthrough());
}
export const TeamsSelectFilter = ({
  selectTriggerClassNames,
  useProfileFilter = false,
  showVerticalDivider = false,
}: {
  selectTriggerClassNames?: string;
  showVerticalDivider?: boolean;
  useProfileFilter?: boolean;
}) => {
  const { t } = useLocale();
  const session = useSession();

  const { data: query, pushItemToKey, removeItemByKeyAndValue, removeAllQueryParams } = useFilterQuery();

  const { data: teams } = trpc.viewer.teams.list.useQuery(undefined, {
    // Teams don't change that frequently
    refetchOnWindowFocus: false,
  });

  const getCurrentValue = () => {
    const teamIds = query.teamIds;
    const users = useProfileFilter ? query.upIds : query.userIds;

    if (teamIds && teamIds.length === 1) {
      return `team-${teamIds[0]}`;
    }
    if (teamIds && teamIds.length > 1) {
      return "multiple-teams";
    }
    if (users && users.length > 0) {
      return "yours";
    }
    return "all";
  };

  const getDisplayValue = () => {
    const teamIds = query.teamIds;
    const users = useProfileFilter ? query.upIds : query.userIds;

    if (teamIds && teamIds.length === 1) {
      const team = teams?.find((t) => t.id === teamIds[0]);
      return team?.name || t("team");
    }
    if (teamIds && teamIds.length > 1) {
      return `${teamIds.length} ${t("teams")}`;
    }
    if (users && users.length > 0) {
      return t("yours");
    }
    return t("all");
  };

  const handleValueChange = (value: string) => {
    // Clear all existing filters first
    removeAllQueryParams();

    if (value === "all") {
      // Already cleared above, nothing more to do
      return;
    }

    if (value === "yours") {
      const userId = session.data?.user?.id || 0;
      const upId = session.data?.upId || "";

      if (useProfileFilter) {
        pushItemToKey("upIds", upId);
      } else {
        pushItemToKey("userIds", userId);
      }
      return;
    }

    if (value.startsWith("team-")) {
      const teamId = parseInt(value.replace("team-", ""));
      pushItemToKey("teamIds", teamId);
      return;
    }
  };

  if (!teams || !teams.length) return null;

  const filteredTeams = teams.filter((team) => !team?.isOrganization);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-700">{t("teams")}:</span>
      <Select value={getCurrentValue()} onValueChange={handleValueChange}>
        <SelectTrigger
          className={`h-9 min-w-[100px] border-gray-200 text-sm ${selectTriggerClassNames || ""}`}>
          <SelectValue>{getDisplayValue()}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Icon name="layers" className="h-4 w-4" />
              {t("all")}
            </div>
          </SelectItem>

          <SelectItem value="yours">
            <div className="flex items-center gap-2">
              <Icon name="user" className="h-4 w-4" />
              {t("yours")}
            </div>
          </SelectItem>

          {filteredTeams.map((team) => (
            <SelectItem key={team.id} value={`team-${team.id}`}>
              <div className="flex items-center gap-2">
                <Avatar alt={team?.name} imageSrc={getOrgOrTeamAvatar(team)} size="xs" />
                {team.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showVerticalDivider && <VerticalDivider />}
    </div>
  );
};
