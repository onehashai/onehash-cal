import { verifyPhoneNumber } from "@onehash/oe-features/workflows/utils/phoneVerification";

import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";

import type { TVerifyPhoneNumberInputSchema } from "./verifyPhoneNumber.schema";

type VerifyPhoneNumberOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TVerifyPhoneNumberInputSchema;
};

export const verifyPhoneNumberHandler = async ({ ctx, input }: VerifyPhoneNumberOptions) => {
  const { phoneNumber, code, teamId } = input;
  const { user } = ctx;
  const verifyStatus = await verifyPhoneNumber(phoneNumber, code, user.id, teamId);
  return verifyStatus;
};
