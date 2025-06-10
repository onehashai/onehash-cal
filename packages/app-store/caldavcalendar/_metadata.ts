import type { AppMeta } from "@calcom/types/App";

import _package from "./package.json";

export const metadata = {
  name: "CalDav (Beta)",
  description: _package.description,
  installed: true,
  type: "caldav_calendar",
  title: "CalDav (Beta)",
  variant: "calendar",
  category: "calendar",
  categories: ["calendar"],
  logo: "icon.svg",
  publisher: "OneHash",
  slug: "caldav-calendar",
  url: "https://www.onehash.ai",
  email: "support@onehash.ai",
  dirName: "caldavcalendar",
  isOAuth: false,
} as AppMeta;

export default metadata;
