import type { AppMeta } from "@calcom/types/App";

import _package from "./package.json";

export const metadata = {
  name: "HubSpot CRM",
  installed: !!process.env.HUBSPOT_CLIENT_ID,
  description: _package.description,
  type: "hubspot_other_calendar",
  variant: "other_calendar",
  logo: "icon.svg",
  publisher: "OneHash",
  url: "https://hubspot.com/",
  categories: ["crm"],
  label: "HubSpot CRM",
  slug: "hubspot",
  title: "HubSpot CRM",
  email: "support@onehash.ai",
  dirName: "hubspot",
} as AppMeta;

export default metadata;
