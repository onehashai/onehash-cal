import type { NextApiRequest, NextApiResponse } from "next";
import { parse } from "querystring";
import getRawBody from "raw-body";

import prisma from "@calcom/prisma";
import { WorkflowMethods, WorkflowStatus } from "@calcom/prisma/client";

// Map event statuses to workflow statuses
const statusMap = {
  delivered: WorkflowStatus.DELIVERED,
  read: WorkflowStatus.READ,
  undelivered: WorkflowStatus.FAILED,
  failed: WorkflowStatus.FAILED,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const rawBody = await getRawBody(req);
    const parsedBody = parse(rawBody.toString());
    const { status: event } = parsedBody;
    const { msgId, eventTypeId, channel } = req.query as {
      msgId: string;
      eventTypeId: string;
      channel: "SMS" | "WHATSAPP";
    };

    if (!msgId || !event || !eventTypeId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const status = statusMap[event as keyof typeof statusMap];
    if (!status) {
      return res.status(200).json({ error: "Status not handled" });
    }

    await prisma.workflowInsights.upsert({
      where: { msgId },
      update: { status },
      create: {
        msgId,
        eventTypeId: Number(eventTypeId),
        type: channel === "SMS" ? WorkflowMethods.SMS : WorkflowMethods.WHATSAPP,
        status,
      },
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in /event-webhook", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
