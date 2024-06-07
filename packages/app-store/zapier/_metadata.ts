import type { AppMeta } from "@calcom/types/App";

import _package from "./package.json";

export const metadata = {
  name: "Zapier",
  description: _package.description,
  installed: true,
  category: "automation",
  categories: ["automation"],
  logo: "icon.svg",
  publisher: "OneHash",
  slug: "zapier",
  title: "Zapier",
  type: "zapier_automation",
  url: "https://cal.onehash.ai/apps/zapier",
  variant: "automation",
  email: "support@onehash.ai",
  dirName: "zapier",
  isOAuth: false,
} as AppMeta;

export default metadata;
