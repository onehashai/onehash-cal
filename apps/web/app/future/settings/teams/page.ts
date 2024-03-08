import { _generateMetadata } from "app/_utils";

import Page from "@calcom/features/oe/teams/pages/team-listing-view";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("teams"),
    (t) => t("create_manage_teams_collaborative")
  );

export default Page;
