import { _generateMetadata } from "app/_utils";

import Page from "@calcom/features/oe/teams/pages/team-members-view";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("team_members"),
    (t) => t("members_team_description")
  );

export default Page;
