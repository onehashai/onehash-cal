import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";
import { WorkflowMethods, WorkflowStatus } from "@calcom/prisma/client";

// // //event - the event type. Possible values are processed, dropped, delivered, deferred, bounce, open, click, spam report, unsubscribe, group unsubscribe, and group resubscribe.
const statusMap = {
  delivered: WorkflowStatus.DELIVERED,
  read: WorkflowStatus.READ,
  undelivered: WorkflowStatus.FAILED,
  failed: WorkflowStatus.FAILED,
};
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { status: event } = req.body;
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

    try {
      await prisma.workflowInsights.upsert({
        where: { msgId: msgId },
        update: {
          status: status,
        },
        create: {
          msgId: msgId,
          eventTypeId: Number(eventTypeId),
          type: channel == "SMS" ? WorkflowMethods.SMS : WorkflowMethods.WHATSAPP,
          status: status,
        },
      });
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error in /event-webhook", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  } else res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
