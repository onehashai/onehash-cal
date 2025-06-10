import type { AppMeta } from "@calcom/types/App";

import _package from "./package.json";

export const metadata = {
  name: "Stripe",
  description: _package.description,
  installed: !!(
    process.env.STRIPE_CLIENT_ID &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY &&
    process.env.STRIPE_PRIVATE_KEY
  ),
  slug: "stripe",
  category: "payment",
  categories: ["payment"],
  logo: "icon.svg",
  publisher: "OneHash",
  title: "Stripe",
  type: "stripe_payment",
  url: "https://www.onehash.ai",
  docsUrl: "https://stripe.com/docs",
  variant: "payment",
  extendsFeature: "EventType",
  email: "support@onehash.ai",
  dirName: "stripepayment",
  isOAuth: true,
} as AppMeta;

export default metadata;
