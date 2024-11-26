import type { IncomingHttpHeaders } from "http";
import jwt from "jsonwebtoken";
import type { NextApiRequest, NextApiResponse } from "next";
import z from "zod";

import { createDefaultInstallation } from "@calcom/app-store/_utils/installation";
import { isPrismaObjOrUndefined } from "@calcom/lib";
import { ONEHASH_API_KEY, WEBAPP_URL } from "@calcom/lib/constants";
import prisma from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import { BookingStatus } from "@calcom/prisma/enums";
import type { OAuthTokenPayload } from "@calcom/types/oauth";

const postSchema = z.object({
  account_name: z.string(),
  account_user_id: z.number(),
  user_id: z.number(),
  user_name: z.string(),
  user_email: z.string(),
});
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case "POST":
        return await postHandler(req, res);
      case "DELETE":
        return await deleteHandler(req, res);
      default:
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({ errors });
    } else {
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
}

const postHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    if (!checkIfTokenIsValid(req.headers)) return res.status(401).json({ message: "Unauthorized" });

    // const payloadFromToken: OAuthTokenPayload = (await getPayloadFromToken(req.headers)) as OAuthTokenPayload;
    // if (!payloadFromToken.userId) return res.status(403).json({ message: "Unable to find user" });
    const { account_user_id, account_name, user_id, user_email, user_name } = postSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: {
        id: user_id,
      },
      select: {
        id: true,
        username: true,
        metadata: true,
        eventTypes: {
          where: {
            parentId: null,
          },
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        bookings: {
          // where: {
          //   status: {
          //     not: BookingStatus.PENDING,
          //   },
          // },
          where: {
            status: BookingStatus.ACCEPTED,
          },
          select: {
            uid: true,
            // status:true,
            startTime: true,
            endTime: true,
            location: true,
            attendees: {
              select: {
                name: true,
                email: true,
                phoneNumber: true,
              },
            },
            eventType: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });
    if (!user) return res.status(403).json({ message: "User not found" });
    const cal_events = user.eventTypes.map((eventType) => {
      return {
        uid: eventType.id,
        title: eventType.title,
        url: `${WEBAPP_URL}/${user.username}/${eventType.slug}`,
      };
    });

    const bookings = user.bookings.map((booking) => {
      return {
        hostName: user.username,
        bookingLocation: booking.location,
        bookingEventType: booking.eventType?.title,
        bookingStartTime: booking.startTime,
        bookingEndTime: booking.endTime,
        bookerEmail: booking.attendees[0].email ?? "N/A",
        bookerPhone: booking.attendees[0].phoneNumber ?? "N/A",
        bookingUid: booking.uid,
        // bookingStatus:booking.status,
      };
    });

    await createDefaultInstallation({
      appType: "onehash",
      user: user,
      slug: "onehash-chat",
      key: {
        account_user_id,
        account_name,
        user_email,
        user_name,
      },
    });

    await setConnectedChatAccounts(user.id, user.metadata);
    console.log("set_chat_accounts");

    return res.json({ cal_events, bookings, user_id: user.id });
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    if (!checkIfTokenIsValid(req.headers)) return res.status(401).json({ message: "Unauthorized" });
    const { cal_user_id, account_user_id } = req.query as {
      cal_user_id: string;
      account_user_id: string;
    };

    const userId = Number(cal_user_id);
    await prisma.credential.deleteMany({
      where: {
        type: "onehash",
        userId,
        key: {
          path: ["account_user_id"],
          equals: Number(account_user_id),
        },
      },
    });
    await unsetConnectedChatAccounts(userId);
    console.log("deleted_chat_accounts");
    return res.json({ message: "Deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

async function setConnectedChatAccounts(user_id: number, metadata: Prisma.JsonValue) {
  const existingMetadata = isPrismaObjOrUndefined(metadata);
  const connectedChatAccounts = (existingMetadata?.connectedChatAccounts as number) ?? 0;

  const updatedMetadata = {
    ...existingMetadata,
    connectedChatAccounts: connectedChatAccounts + 1,
  };

  await prisma.user.update({
    where: {
      id: user_id,
    },
    data: {
      metadata: updatedMetadata,
    },
  });
}
async function unsetConnectedChatAccounts(user_id: number) {
  // Get the current user data with metadata
  const user = await prisma.user.findUnique({
    where: {
      id: user_id,
    },
  });

  // Ensure user exists and metadata contains connectedChatAccounts
  if (!user) {
    throw new Error("User not found ");
  }

  const existingMetadata = isPrismaObjOrUndefined(user.metadata);
  const connectedChatAccounts = (existingMetadata?.connectedChatAccounts as number) ?? 0;

  if (connectedChatAccounts === 0) {
    return Promise.resolve();
    // throw new Error("User already has no connected chat accounts");
  }

  if (connectedChatAccounts === 1) {
    delete existingMetadata?.connectedChatAccounts;
  } else {
    if (existingMetadata) {
      existingMetadata.connectedChatAccounts = connectedChatAccounts - 1;
    }
  }

  await prisma.user.update({
    where: { id: user_id },
    data: { metadata: existingMetadata },
  });
}

const getPayloadFromToken = async (headers: IncomingHttpHeaders) => {
  const authHeader = headers["authorization"];
  if (!authHeader) return null;

  const access_token = authHeader.split(" ")[1];
  const secretKey = process.env.CALENDSO_ENCRYPTION_KEY || "";
  const decoded = await new Promise<OAuthTokenPayload | string>((resolve, reject) => {
    jwt.verify(access_token, secretKey, (err, decoded) => {
      if (err) {
        reject(new Error(`Invalid token: ${err.message}`));
      } else {
        resolve(decoded as OAuthTokenPayload);
      }
    });
  });

  return decoded;
};

const checkIfTokenIsValid = (headers: IncomingHttpHeaders) => {
  const authHeader = headers["authorization"];
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  return token === ONEHASH_API_KEY;
};
