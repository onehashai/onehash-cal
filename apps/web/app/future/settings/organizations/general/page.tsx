import { _generateMetadata } from "app/_utils";

import Page from "@calcom/features/oe/organizations/pages/settings/general";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("general"),
    (t) => t("general_description")
  );

export default Page;
