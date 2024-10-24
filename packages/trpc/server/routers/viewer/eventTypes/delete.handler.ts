import { ONEHASH_API_KEY, ONEHASH_CHAT_SYNC_BASE_URL } from "@calcom/lib/constants";
import { prisma } from "@calcom/prisma";

import type { TrpcSessionUser } from "../../../trpc";
import type { TDeleteInputSchema } from "./delete.schema";

type DeleteOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TDeleteInputSchema;
};

export const deleteHandler = async ({ ctx: _ctx, input }: DeleteOptions) => {
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

  if (_ctx.user.metadata?.oh_chat_enabled) {
    await handleOHChatSync(id, _ctx.user.email);
  }
  return {
    id,
  };
};

const handleOHChatSync = async (uid: string, email: string) => {
  await fetch(`${ONEHASH_CHAT_SYNC_BASE_URL}/cal_event`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ONEHASH_API_KEY}`,
    },
    body: JSON.stringify({
      email,
      uid,
    }),
  });
};
