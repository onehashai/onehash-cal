/* Schedule any workflow reminder that falls within 7 days for WHATSAPP */
import type { NextApiRequest, NextApiResponse } from "next";

import dayjs from "@calcom/dayjs";
import { defaultHandler } from "@calcom/lib/server";
import prisma from "@calcom/prisma";
import { WorkflowActions, WorkflowMethods } from "@calcom/prisma/enums";

import type { PartialWorkflowReminder } from "../lib/getWorkflowReminders";
import { select } from "../lib/getWorkflowReminders";
import * as twilio from "../lib/reminders/providers/twilioProvider";

async function deletePastReminders() {
  await prisma.workflowReminder.deleteMany({
    where: {
      method: WorkflowMethods.WHATSAPP,
      scheduledDate: {
        lte: dayjs().toISOString(),
      },
      //to preserve workflows that weren't scheduled due to some reason
      scheduled: false,
      OR: [{ cancelled: null }, { cancelled: false }],
    },
  });
}

async function getUnscheduledReminders() {
  return prisma.workflowReminder.findMany({
    where: {
      method: WorkflowMethods.WHATSAPP,
      scheduled: false,
      scheduledDate: {
        lte: dayjs().add(7, "day").toISOString(),
      },
      OR: [{ cancelled: null }, { cancelled: false }],
    },
    select,
  });
}
async function scheduleReminders() {
  const unscheduledReminders = (await getUnscheduledReminders()) as PartialWorkflowReminder[];

  for (const reminder of unscheduledReminders) {
    if (!reminder.workflowStep || !reminder.booking) {
      continue;
    }
    const userId = reminder.workflowStep.workflow.userId;
    const teamId = reminder.workflowStep.workflow.teamId;

    try {
      const sendTo =
        reminder.workflowStep.action === WorkflowActions.WHATSAPP_NUMBER
          ? reminder.workflowStep.sendTo
          : reminder.booking?.smsReminderNumber;

      const userName = reminder.booking?.user?.name;

      const attendeeName = reminder.booking?.attendees[0].name;

      const timeZone =
        reminder.workflowStep.action === WorkflowActions.WHATSAPP_ATTENDEE
          ? reminder.booking?.attendees[0].timeZone
          : reminder.booking?.user?.timeZone;

      // const templateFunction = getWhatsappTemplateFunction(reminder.workflowStep.template);
      // const message = templateFunction(
      //   false,
      //   reminder.workflowStep.action,
      //   getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat),
      //   reminder.booking?.startTime.toISOString() || "",
      //   reminder.booking?.eventType?.title || "",
      //   timeZone || "",
      //   attendeeName || "",
      //   userName
      // );

      const { workflowStep, booking } = reminder;
      const contentVars = twilio.generateContentVars(
        {
          workflowStep: {
            action: workflowStep.action,
            template: workflowStep.template,
          },
          booking: {
            eventType: {
              title: booking.eventType?.title ?? "N/A",
            },
            startTime: booking.startTime,
            user: {
              locale: booking.user?.locale,
              timeFormat: booking.user?.timeFormat,
            },
          },
        },
        attendeeName || "",
        userName || "",
        timeZone || ""
      );

      // if (message?.length && message?.length > 0 && sendTo) {
      if (sendTo) {
        const scheduledSMS = await twilio.scheduleSMS(
          sendTo,
          "",
          reminder.scheduledDate,
          "",
          userId,
          teamId,
          true,
          reminder.workflowStep.template,
          JSON.stringify(contentVars),
          reminder.booking?.eventType?.id ? { eventTypeId: reminder.booking?.eventType?.id } : undefined
        );

        if (scheduledSMS) {
          await prisma.workflowReminder.update({
            where: {
              id: reminder.id,
            },
            data: {
              scheduled: true,
              referenceId: scheduledSMS.sid,
            },
          });
        }
      }
    } catch (error) {
      console.log(`Error scheduling WHATSAPP with error ${error}`);
    }
  }

  return unscheduledReminders.length;
}

async function invokeCancelledReminders() {
  const scheduledSendsToCancel = await prisma.workflowReminder.findMany({
    where: {
      method: WorkflowMethods.WHATSAPP,
      scheduled: true,
      cancelled: true,
      scheduledDate: {
        lte: dayjs().add(1, "hour").toISOString(),
      },
    },
  });

  const cancellationPromises = [];
  for (const scheduledSendToCancel of scheduledSendsToCancel) {
    if (scheduledSendToCancel.referenceId) {
      // Twilio cancel request promise
      const cancellationReqPromise = twilio.cancelSMS(scheduledSendToCancel.referenceId);

      // Prisma update promise
      const statusUpdatePromise = prisma.workflowReminder.update({
        where: {
          id: scheduledSendToCancel.id,
        },
        data: {
          referenceId: null,
          scheduled: false,
        },
      });

      cancellationPromises.push(cancellationReqPromise, statusUpdatePromise);
    }
  }

  await Promise.all(cancellationPromises);
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  //delete all scheduled whatsapp reminders where scheduled date is past current date
  await deletePastReminders();

  // Cancel Scheduled sends whose workflow reminders are marked as Cancelled
  await invokeCancelledReminders();
  //find all unscheduled WHATSAPP reminders
  const remindersToScheduleNum = await scheduleReminders();

  res.status(200).json({ message: `${remindersToScheduleNum} WHATSAPP scheduled` });
}

export default defaultHandler({
  POST: Promise.resolve({ default: handler }),
});
