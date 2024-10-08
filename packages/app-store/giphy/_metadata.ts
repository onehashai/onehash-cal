import type { AppMeta } from "@calcom/types/App";

import _package from "./package.json";

export const metadata = {
  name: "Giphy",
  description: _package.description,
  installed: true,
  categories: ["other"],
  logo: "icon.svg",
  publisher: "OneHash",
  slug: "giphy",
  title: "Giphy",
  type: "giphy_other",
  url: "https://support.giphy.com/",
  variant: "other",
  extendsFeature: "EventType",
  email: "support@onehash.ai",
  dirName: "giphy",
  isOAuth: false,
} as AppMeta;

export default metadata;
