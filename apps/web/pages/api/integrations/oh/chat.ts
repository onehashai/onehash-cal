// pages/api/example.ts
import type { IncomingHttpHeaders } from "http";
import type { NextApiRequest, NextApiResponse } from "next";
import z from "zod";

import { ONEHASH_API_KEY, WEBAPP_URL } from "@calcom/lib/constants";
import prisma from "@calcom/prisma";

const postSchema = z.object({
  email: z.string().email("Invalid email address"),
});
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
    if (!checkIfTokenIsValid(req.headers)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { email } = postSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
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
    const updatedMetadata = {
      ...user.metadata,
      oh_chat_enabled: true, //flag to indicate if OneHash chat is integrated with user account
    };

    await prisma.user.update({
      where: {
        email,
      },
      data: {
        metadata: updatedMetadata,
      },
    });

    return res.json({ cal_events });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({ errors });
    } else {
      console.log("Error", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
}

const checkIfTokenIsValid = (headers: IncomingHttpHeaders) => {
  const authHeader = headers["authorization"];
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  return token === ONEHASH_API_KEY;
};
