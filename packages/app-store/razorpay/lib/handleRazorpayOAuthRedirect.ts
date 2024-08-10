import type { ParsedUrlQuery } from "querystring";
import { z } from "zod";

import {
  IS_PRODUCTION,
  RAZORPAY_CLIENT_ID,
  RAZORPAY_CLIENT_SECRET,
  RAZORPAY_REDIRECT_URL,
  RAZORPAY_STATE_KEY,
} from "@calcom/lib/constants";
import prisma from "@calcom/prisma";

const handleRazorpayOAuthRedirect = async (query: ParsedUrlQuery, userId: number) => {
  if (query.state) {
    const { code, state } = query;

    if (!code || state !== RAZORPAY_STATE_KEY) {
      throw new Error("Razorpay oauth response malformed");
    }

    const res = await fetch("https://auth.razorpay.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: RAZORPAY_CLIENT_ID,
        client_secret: RAZORPAY_CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: RAZORPAY_REDIRECT_URL,
        code,
        mode: IS_PRODUCTION ? "live" : "test",
      }),
    });
    if (!res.ok) {
      throw new Error("Failed to fetch razorpay token");
    }
    const { access_token, refresh_token, public_token, razorpay_account_id } = await res.json();

    const installation = await prisma.credential.create({
      data: {
        type: "razorpay_payment",
        key: {
          access_token,
          refresh_token,
          public_token,
          account_id: razorpay_account_id,
          userId: userId,
        },
        userId: userId,
        appId: "razorpay",
      },
    });
    if (!installation) {
      throw new Error("Unable to create user credential for Razorpay");
    }
    return "razorpay";
  } else {
    return z.coerce.string().parse(query?.slug);
  }
};

export default handleRazorpayOAuthRedirect;
