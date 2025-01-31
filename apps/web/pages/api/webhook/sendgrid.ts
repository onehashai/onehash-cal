import type { NextApiRequest, NextApiResponse } from "next";

// //event - the event type. Possible values are processed, dropped, delivered, deferred, bounce, open, click, spam report, unsubscribe, group unsubscribe, and group resubscribe.
// const statusMap = {
//   delivered: WorkflowStatus.DELIVERED,
//   open: WorkflowStatus.READ,
//   dropped: WorkflowStatus.FAILED,
//   bounce: WorkflowStatus.FAILED,
//   // processed: WorkflowStatus.PROCESSED,
//   // deferred: WorkflowStatus.DEFERRED,
//   // click: WorkflowStatus.CLICK,
//   // spamreport: WorkflowStatus.SPAM_REPORT,
//   // unsubscribe: WorkflowStatus.UNSUBSCRIBE,
//   // groupunsubscribe: WorkflowStatus.GROUP_UNSUBSCRIBE,
//   // groupresubscribe: WorkflowStatus.GROUP_RESUBSCRIBE,
// };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  //   if (req.method === "POST") {
  //     const { msgId, event, eventTypeId } = req.body;
  //     if (!msgId || !event || !eventTypeId) {
  //       return res.status(400).json({ error: "Missing required fields" });
  //     }

  //     const status = statusMap[event];
  //     if (!status) {
  //       return res.status(400).json({ error: "Status not handled" });
  //     }
  //     const upsertWorkflowInsight = await prisma.workflowInsights.upsert({
  //       where: { msgId: msgId },
  //       update: {
  //         status: status,
  //       },
  //       create: {
  //         msgId: msgId,
  //         eventTypeId: eventTypeId,
  //         type: WorkflowMethods.EMAIL,
  //         status: status,
  //       },
  //     });
  //   }

  res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
