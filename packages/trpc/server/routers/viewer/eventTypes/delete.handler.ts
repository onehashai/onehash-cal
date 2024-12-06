import { ONEHASH_API_KEY, ONEHASH_CHAT_SYNC_BASE_URL } from "@calcom/lib/constants";
import { isPrismaObjOrUndefined } from "@calcom/lib/isPrismaObj";
import { prisma } from "@calcom/prisma";

import type { TrpcSessionUser } from "../../../trpc";
import type { TDeleteInputSchema } from "./delete.schema";

type DeleteOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TDeleteInputSchema;
};

export const deleteHandler = async ({ ctx, input }: DeleteOptions) => {
  const { id } = input;

  await prisma.eventTypeCustomInput.deleteMany({
    where: {
      eventTypeId: id,
    },
  });

  await prisma.eventType.delete({
    where: {
      id,
    },
  });

  if (isPrismaObjOrUndefined(ctx.user.metadata)?.connectedChatAccounts) {
    await handleOHChatSync(id);
  }
  return {
    id,
  };
};

const handleOHChatSync = async (eventUid: string) => {
  const credential = await prisma.credential.findFirst({
    where: {
      appId: "onehast-chat",
      userId: uid,
    },
  });
  const account_user_id: string = isPrismaObjOrUndefined(credential?.key)?.account_user_id.toString();
  if (!account_user_id) return Promise.resolve(null);
  const queryParams = new URLSearchParams({ account_user_id: account_user_id, uid: uid });

  await fetch(`${ONEHASH_CHAT_SYNC_BASE_URL}/cal_event?${queryParams}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ONEHASH_API_KEY}`,
    },
  });
};
