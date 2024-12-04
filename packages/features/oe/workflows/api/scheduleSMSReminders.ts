/* Schedule any workflow reminder that falls within 7 days for SMS */
import type { NextApiRequest, NextApiResponse } from "next";

import dayjs from "@calcom/dayjs";
import { getCalEventResponses } from "@calcom/features/bookings/lib/getCalEventResponses";
import { getBookerBaseUrl } from "@calcom/lib/getBookerUrl/server";
import { defaultHandler } from "@calcom/lib/server";
import { getTimeFormatStringFromUserTimeFormat } from "@calcom/lib/timeFormat";
import prisma from "@calcom/prisma";
import { WorkflowActions, WorkflowMethods, WorkflowTemplates } from "@calcom/prisma/enums";
import { bookingMetadataSchema } from "@calcom/prisma/zod-utils";

import { getSenderId } from "../lib/alphanumericSenderIdSupport";
import type { PartialWorkflowReminder } from "../lib/getWorkflowReminders";
import { select } from "../lib/getWorkflowReminders";
import * as twilio from "../lib/reminders/providers/twilioProvider";
import type { VariablesType } from "../lib/reminders/templates/customTemplate";
import customTemplate from "../lib/reminders/templates/customTemplate";
import smsReminderTemplate from "../lib/reminders/templates/smsReminderTemplate";

async function getUnscheduledReminders() {
  return prisma.workflowReminder.findMany({
    where: {
      method: WorkflowMethods.SMS,
      scheduled: false,
      scheduledDate: {
        lte: dayjs().add(7, "day").toISOString(),
      },
      OR: [{ cancelled: null }, { cancelled: false }],
    },
    select: {
      ...select,
      retryCount: true,
    },
  });
}
async function scheduleReminders() {
  const unscheduledReminders = (await getUnscheduledReminders()) as (PartialWorkflowReminder & {
    retryCount: number;
  })[];

  for (const reminder of unscheduledReminders) {
    if (!reminder.workflowStep || !reminder.booking) {
      continue;
    }
    const userId = reminder.workflowStep.workflow.userId;
    const teamId = reminder.workflowStep.workflow.teamId;

    try {
      const sendTo =
        reminder.workflowStep.action === WorkflowActions.SMS_NUMBER
          ? reminder.workflowStep.sendTo
          : reminder.booking?.smsReminderNumber;

      const userName =
        reminder.workflowStep.action === WorkflowActions.SMS_ATTENDEE
          ? reminder.booking?.attendees[0].name
          : "";

      const attendeeName =
        reminder.workflowStep.action === WorkflowActions.SMS_ATTENDEE
          ? reminder.booking?.user?.name
          : reminder.booking?.attendees[0].name;

      const timeZone =
        reminder.workflowStep.action === WorkflowActions.SMS_ATTENDEE
          ? reminder.booking?.attendees[0].timeZone
          : reminder.booking?.user?.timeZone;

      const senderID = getSenderId(sendTo, reminder.workflowStep.sender);

      const locale =
        reminder.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE ||
        reminder.workflowStep.action === WorkflowActions.SMS_ATTENDEE
          ? reminder.booking?.attendees[0].locale
          : reminder.booking?.user?.locale;

      let message: string | null = reminder.workflowStep.reminderBody || null;

      if (reminder.workflowStep.reminderBody) {
        const { responses } = getCalEventResponses({
          bookingFields: reminder.booking.eventType?.bookingFields ?? null,
          booking: reminder.booking,
        });

        const organizerOrganizationProfile = await prisma.profile.findFirst({
          where: {
            userId: reminder.booking.user?.id,
          },
        });

        const organizerOrganizationId = organizerOrganizationProfile?.organizationId;

        const bookerUrl = await getBookerBaseUrl(
          reminder.booking.eventType?.team?.parentId ?? organizerOrganizationId ?? null
        );

        const variables: VariablesType = {
          eventName: reminder.booking?.eventType?.title,
          organizerName: reminder.booking?.user?.name || "",
          attendeeName: reminder.booking?.attendees[0].name,
          attendeeEmail: reminder.booking?.attendees[0].email,
          eventDate: dayjs(reminder.booking?.startTime).tz(timeZone),
          eventEndTime: dayjs(reminder.booking?.endTime).tz(timeZone),
          timeZone: timeZone,
          location: reminder.booking?.location || "",
          additionalNotes: reminder.booking?.description,
          responses: responses,
          meetingUrl: bookingMetadataSchema.parse(reminder.booking?.metadata || {})?.videoCallUrl,
          cancelLink: `${bookerUrl}/booking/${reminder.booking.uid}?cancel=true`,
          rescheduleLink: `${bookerUrl}/reschedule/${reminder.booking.uid}`,
        };
        const customMessage = customTemplate(
          reminder.workflowStep.reminderBody || "",
          variables,
          locale || "en",
          getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat)
        );
        message = customMessage.text;
      } else if (reminder.workflowStep.template === WorkflowTemplates.REMINDER) {
        message = smsReminderTemplate(
          false,
          reminder.workflowStep.action,
          getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat),
          reminder.booking?.startTime.toISOString() || "",
          reminder.booking?.eventType?.title || "",
          timeZone || "",
          attendeeName || "",
          userName
        );
      }

      if (message?.length && message?.length > 0 && sendTo) {
        const scheduledSMS = await twilio.scheduleSMS(
          sendTo,
          message,
          reminder.scheduledDate,
          senderID,
          userId,
          teamId
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
        } else {
          await prisma.workflowReminder.update({
            where: {
              id: reminder.id,
            },
            data: {
              retryCount: reminder.retryCount + 1,
            },
          });
        }
      }
    } catch (error) {
      await prisma.workflowReminder.update({
        where: {
          id: reminder.id,
        },
        data: {
          retryCount: reminder.retryCount + 1,
        },
      });
      console.log(`Error scheduling SMS with error ${error}`);
    }
  }
  return unscheduledReminders.length;
}

async function deletePastReminders() {
  await prisma.workflowReminder.deleteMany({
    where: {
      OR: [
        {
          method: WorkflowMethods.SMS,
          scheduledDate: {
            lte: dayjs().toISOString(),
          },
        },
        {
          retryCount: {
            gt: 1,
          },
        },
      ],
    },
  });
}

async function invokeCancelledReminders() {
  const scheduledSendsToCancel = await prisma.workflowReminder.findMany({
    where: {
      method: WorkflowMethods.SMS,
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
  if (!process.env.CRON_API_KEY || authHeader !== process.env.CRON_API_KEY) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  //delete all scheduled sms reminders where scheduled date is past current date
  await deletePastReminders();

  // Cancel Scheduled sends whose workflow reminders are marked as Cancelled
  await invokeCancelledReminders();

  //find all unscheduled SMS reminders
  const remindersToScheduleNum = await scheduleReminders();
  res.status(200).json({ message: `${remindersToScheduleNum} SMS scheduled` });
}

export default defaultHandler({
  POST: Promise.resolve({ default: handler }),
});
