import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";
import { WorkflowMethods, WorkflowStatus } from "@calcom/prisma/client";

// //event - the event type. Possible values are processed, dropped, delivered, deferred, bounce, open, click, spam report, unsubscribe, group unsubscribe, and group resubscribe.
const statusMap = {
  delivered: WorkflowStatus.DELIVERED,
  open: WorkflowStatus.READ,
  dropped: WorkflowStatus.FAILED,
  bounce: WorkflowStatus.FAILED,
  deferred: WorkflowStatus.FAILED,
  // processed: WorkflowStatus.PROCESSED,
  // click: WorkflowStatus.CLICK,
  // spamreport: WorkflowStatus.SPAM_REPORT,
  // unsubscribe: WorkflowStatus.UNSUBSCRIBE,
  // groupunsubscribe: WorkflowStatus.GROUP_UNSUBSCRIBE,
  // groupresubscribe: WorkflowStatus.GROUP_RESUBSCRIBE,
};
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    //VERIFICATION
    // const signature = req.headers["X-Twilio-Email-Event-Webhook-Signature"] as string;
    // const timestamp = req.headers[EventWebhookHeader.TIMESTAMP()] as string;
    // console.log("in_here_headers", signature, timestamp);
    // const verify = new EventWebhook();
    // const payload = req.body;
    // const publicKey = process.env.SENDGRID_WEBHOOK_PK;

    // if (!signature || !timestamp || !publicKey) {
    //   return res.status(400).json({ error: "Missing required headers" });
    // }

    // const ecdsaPublicKey = verify.convertPublicKeyToECDSA(publicKey);
    // const isVerified = verify.verifySignature(ecdsaPublicKey, payload, signature, timestamp);
    // console.log("in_here_verified", isVerified);
    // if (!isVerified) {
    //   return res.status(400).json({ error: "Invalid signature" });
    // }

    const {
      msgId,
      event,
      eventTypeId,
    }: { msgId: string; event: keyof typeof statusMap; eventTypeId: number } = req.body;
    if (!msgId || !event || !eventTypeId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const status = statusMap[event];
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
          eventTypeId: eventTypeId,
          type: WorkflowMethods.EMAIL,
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
