import { _generateMetadata } from "app/_utils";

import Page from "@calcom/features/oe/organizations/pages/settings/attributes/attributes-create-view";

export const generateMetadata = async () =>
  await _generateMetadata(
    () => "Attribute",
    () => "Create an attribute for your team members"
  );

export default Page;
