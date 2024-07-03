import type { GetStaticPropsContext } from "next";

import getAppKeysFromSlug from "../../../_utils/getAppKeysFromSlug";

export const getStaticProps = async (ctx: GetStaticPropsContext) => {
  if (typeof ctx.params?.slug !== "string") return { notFound: true } as const;
  let keyId = "";
  let keySecret = "";
  let merchantId = "";
  const appKeys = await getAppKeysFromSlug("razorpay");
  if (
    typeof appKeys.key_id === "string" &&
    typeof appKeys.key_secret === "string" &&
    typeof appKeys.merchant_id === "string"
  ) {
    keyId = appKeys.key_id;
    keySecret = appKeys.key_secret;
    merchantId = appKeys.merchant_id;
  }

  return {
    props: {
      keyId,
      keySecret,
    },
  };
};
