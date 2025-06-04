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

const fetchPendingNotifications = async () => {
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
};

const processNotificationQueue = async (): Promise<number> => {
  const pendingNotifications = (await fetchPendingNotifications()) as (PartialWorkflowReminder & {
    retryCount: number;
  })[];

  for (const notification of pendingNotifications) {
    if (!notification.workflowStep || !notification.booking) {
      continue;
    }
    const workflowUserId = notification.workflowStep.workflow.userId;
    const workflowTeamId = notification.workflowStep.workflow.teamId;

    try {
      const recipientNumber =
        notification.workflowStep.action === WorkflowActions.SMS_NUMBER
          ? notification.workflowStep.sendTo
          : notification.booking?.smsReminderNumber;

      const recipientDisplayName =
        notification.workflowStep.action === WorkflowActions.SMS_ATTENDEE
          ? notification.booking?.attendees[0].name
          : "";

      const participantDisplayName =
        notification.workflowStep.action === WorkflowActions.SMS_ATTENDEE
          ? notification.booking?.user?.name
          : notification.booking?.attendees[0].name;

      const participantTimeZone =
        notification.workflowStep.action === WorkflowActions.SMS_ATTENDEE
          ? notification.booking?.attendees[0].timeZone
          : notification.booking?.user?.timeZone;

      const messageSenderId = getSenderId(recipientNumber, notification.workflowStep.sender);

      const participantLocale =
        notification.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE ||
        notification.workflowStep.action === WorkflowActions.SMS_ATTENDEE
          ? notification.booking?.attendees[0].locale
          : notification.booking?.user?.locale;

      let messageText: string | null = notification.workflowStep.reminderBody || null;

      if (notification.workflowStep.reminderBody) {
        const { responses } = getCalEventResponses({
          bookingFields: notification.booking.eventType?.bookingFields ?? null,
          booking: notification.booking,
        });

        const organizerProfile = await prisma.profile.findFirst({
          where: {
            userId: notification.booking.user?.id,
          },
        });

        const organizerOrgId = organizerProfile?.organizationId;

        const bookingBaseUrl = await getBookerBaseUrl(
          notification.booking.eventType?.team?.parentId ?? organizerOrgId ?? null
        );

        const templateData: VariablesType = {
          eventName: notification.booking?.eventType?.title,
          organizerName: notification.booking?.user?.name || "",
          attendeeName: notification.booking?.attendees[0].name,
          attendeeEmail: notification.booking?.attendees[0].email,
          eventDate: dayjs(notification.booking?.startTime).tz(participantTimeZone),
          eventEndTime: dayjs(notification.booking?.endTime).tz(participantTimeZone),
          timeZone: participantTimeZone,
          location: notification.booking?.location || "",
          additionalNotes: notification.booking?.description,
          responses: responses,
          meetingUrl: bookingMetadataSchema.parse(notification.booking?.metadata || {})?.videoCallUrl,
          cancelLink: `${bookingBaseUrl}/booking/${notification.booking.uid}?cancel=true`,
          rescheduleLink: `${bookingBaseUrl}/reschedule/${notification.booking.uid}`,
        };
        const processedMessage = customTemplate(
          notification.workflowStep.reminderBody || "",
          templateData,
          participantLocale || "en",
          getTimeFormatStringFromUserTimeFormat(notification.booking.user?.timeFormat)
        );
        messageText = processedMessage.text;
      } else if (notification.workflowStep.template === WorkflowTemplates.REMINDER) {
        messageText = smsReminderTemplate(
          false,
          participantLocale ?? "en",
          notification.workflowStep.action,
          getTimeFormatStringFromUserTimeFormat(notification.booking.user?.timeFormat),
          notification.booking?.startTime.toISOString() || "",
          notification.booking?.eventType?.title || "",
          participantTimeZone || "",
          participantDisplayName || "",
          recipientDisplayName
        );
      }

      if (messageText?.length && messageText?.length > 0 && recipientNumber) {
        const dispatchedSMS = await twilio.scheduleSMS(
          recipientNumber,
          messageText,
          notification.scheduledDate,
          messageSenderId,
          workflowUserId,
          workflowTeamId,
          false,
          undefined,
          undefined,
          notification.booking?.eventTypeId ? { eventTypeId: notification.booking?.eventTypeId } : undefined
        );

        if (dispatchedSMS) {
          await prisma.workflowReminder.update({
            where: {
              id: notification.id,
            },
            data: {
              scheduled: true,
              referenceId: dispatchedSMS.sid,
            },
          });
        } else {
          await prisma.workflowReminder.update({
            where: {
              id: notification.id,
            },
            data: {
              retryCount: notification.retryCount + 1,
            },
          });
        }
      }
    } catch (error) {
      await prisma.workflowReminder.update({
        where: {
          id: notification.id,
        },
        data: {
          retryCount: notification.retryCount + 1,
        },
      });
      console.log(`SMS scheduling failed with error ${error}`);
    }
  }
  return pendingNotifications.length;
};

const removeExpiredNotifications = async (): Promise<void> => {
  await prisma.workflowReminder.deleteMany({
    where: {
      OR: [
        {
          method: WorkflowMethods.SMS,
          scheduledDate: {
            lte: dayjs().toISOString(),
          },
          scheduled: false,
          OR: [{ cancelled: null }, { cancelled: false }],
        },
        {
          retryCount: {
            gt: 1,
          },
        },
      ],
    },
  });
};

const executeCancellationProcess = async (): Promise<void> => {
  const messagesToCancel = await prisma.workflowReminder.findMany({
    where: {
      method: WorkflowMethods.SMS,
      scheduled: true,
      cancelled: true,
      scheduledDate: {
        lte: dayjs().add(1, "hour").toISOString(),
      },
    },
  });

  const cancellationTasks = [];
  for (const messageToCancel of messagesToCancel) {
    if (messageToCancel.referenceId) {
      const twilioRequest = twilio.cancelSMS(messageToCancel.referenceId);

      const databaseUpdate = prisma.workflowReminder.update({
        where: {
          id: messageToCancel.id,
        },
        data: {
          referenceId: null,
          scheduled: false,
        },
      });

      cancellationTasks.push(twilioRequest, databaseUpdate);
    }
  }

  await Promise.all(cancellationTasks);
};

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  const authorizationHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authorizationHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  await removeExpiredNotifications();

  await executeCancellationProcess();

  const scheduledMessagesCount = await processNotificationQueue();
  res.status(200).json({ message: `${scheduledMessagesCount} SMS scheduled` });
};

export default defaultHandler({
  POST: Promise.resolve({ default: handler }),
});
