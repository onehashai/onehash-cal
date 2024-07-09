import type { GetStaticPropsContext } from "next";

import getAppKeysFromSlug from "../../../_utils/getAppKeysFromSlug";

export const getStaticProps = async (ctx: GetStaticPropsContext) => {
  if (typeof ctx.params?.slug !== "string") return { notFound: true } as const;
  let key_id = "";
  let key_secret = "";
  let merchant_id = "";
  const appKeys = await getAppKeysFromSlug("razorpay");
  if (
    typeof appKeys.key_id === "string" &&
    typeof appKeys.key_secret === "string" &&
    typeof appKeys.merchant_id === "string"
  ) {
    key_id = appKeys.key_id;
    key_secret = appKeys.key_secret;
    merchant_id = appKeys.merchant_id;
  }

  return {
    props: {
      key_id,
      key_secret,
      merchant_id,
    },
  };
};
