import type { AppMeta } from "@calcom/types/App";

import _package from "./package.json";

export const metadata = {
  name: "Outlook Calendar",
  description: _package.description,
  type: "office365_calendar",
  title: "Outlook Calendar",
  variant: "calendar",
  category: "calendar",
  categories: ["calendar"],
  logo: "icon.svg",
  publisher: "OneHash",
  slug: "office365-calendar",
  dirName: "office365calendar",
  url: "https://www.onehash.ai",
  email: "support@onehash.ai",
  isOAuth: true,
} as AppMeta;

export default metadata;
