import { _generateMetadata } from "app/_utils";

import OrgAttributesEditPage from "@calcom/features/oe/organizations/pages/settings/attributes/attributes-edit-view";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("attribute"),
    (t) => t("edit_attribute_description")
  );

export default OrgAttributesEditPage;
