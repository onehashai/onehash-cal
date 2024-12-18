/* Schedule any workflow reminder that falls within 72 hours for email */
import type { NextApiRequest, NextApiResponse } from "next";
import { v4 as uuidv4 } from "uuid";

import dayjs from "@calcom/dayjs";
import { getCalEventResponses } from "@calcom/features/bookings/lib/getCalEventResponses";
import { getBookerBaseUrl } from "@calcom/lib/getBookerUrl/server";
import logger from "@calcom/lib/logger";
import { defaultHandler } from "@calcom/lib/server";
import { getTimeFormatStringFromUserTimeFormat } from "@calcom/lib/timeFormat";
import prisma from "@calcom/prisma";
import { SchedulingType, WorkflowActions, WorkflowMethods, WorkflowTemplates } from "@calcom/prisma/enums";
import { bookingMetadataSchema } from "@calcom/prisma/zod-utils";

import type { PartialWorkflowReminder } from "../lib/getWorkflowReminders";
import { getAllRemindersToCancel, getAllUnscheduledReminders } from "../lib/getWorkflowReminders";
import { getiCalEventAsString } from "../lib/getiCalEventAsString";
import {
  cancelScheduledEmail,
  getBatchId,
  sendSendgridMail,
} from "../lib/reminders/providers/sendgridProvider";
import type { VariablesType } from "../lib/reminders/templates/customTemplate";
import customTemplate from "../lib/reminders/templates/customTemplate";
import emailRatingTemplate from "../lib/reminders/templates/emailRatingTemplate";
import emailReminderTemplate from "../lib/reminders/templates/emailReminderTemplate";
import emailThankYouTemplate from "../lib/reminders/templates/emailThankYouTemplate";

async function deletePastReminders() {
  await prisma.workflowReminder.deleteMany({
    where: {
      method: WorkflowMethods.EMAIL,
      scheduledDate: {
        lte: dayjs().toISOString(),
      },
    },
  });
}

async function invokeCancelledReminders() {
  const remindersToCancel: { referenceId: string | null; id: number }[] = await getAllRemindersToCancel();

  const cancelUpdatePromises: Promise<any>[] = [];

  for (const reminder of remindersToCancel) {
    const cancelPromise = cancelScheduledEmail(reminder.referenceId);

    const updatePromise = prisma.workflowReminder.update({
      where: {
        id: reminder.id,
      },
      data: {
        scheduled: false, // to know which reminder already got cancelled (to avoid error from cancelling the same reminders again)
      },
    });

    cancelUpdatePromises.push(cancelPromise, updatePromise);
  }

  Promise.allSettled(cancelUpdatePromises).then((results) => {
    results.forEach((result) => {
      if (result.status === "rejected") {
        logger.error(`Error cancelling scheduled_sends: ${result.reason}`);
      }
    });
  });
}
async function scheduleReminders() {
  const sendEmailPromises: Promise<any>[] = [];

  const unscheduledReminders: PartialWorkflowReminder[] = await getAllUnscheduledReminders();

  for (const reminder of unscheduledReminders) {
    if (!reminder.booking) {
      continue;
    }
    if (!reminder.isMandatoryReminder && reminder.workflowStep) {
      try {
        let sendTo;

        switch (reminder.workflowStep.action) {
          case WorkflowActions.EMAIL_HOST:
            sendTo = reminder.booking?.userPrimaryEmail ?? reminder.booking.user?.email;
            const hosts = reminder?.booking?.eventType?.hosts
              ?.filter((host) =>
                reminder.booking?.attendees.some((attendee) => attendee.email === host.user.email)
              )
              .map(({ user }) => user.destinationCalendar?.primaryEmail ?? user.email);
            const schedulingType = reminder.booking.eventType?.schedulingType;

            if (
              hosts &&
              (schedulingType === SchedulingType.COLLECTIVE || schedulingType === SchedulingType.ROUND_ROBIN)
            ) {
              sendTo = sendTo ? [sendTo, ...hosts] : hosts;
            }
            break;
          case WorkflowActions.EMAIL_ATTENDEE:
            //TODO:check if reminder has reference to attendee
            //if yes pick email from there
            sendTo = reminder.attendee ? reminder.attendee.email : reminder.booking.attendees[0].email;
            break;
          case WorkflowActions.EMAIL_ADDRESS:
            sendTo = reminder.workflowStep.sendTo;
        }

        const name =
          reminder.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE
            ? reminder.attendee
              ? reminder.attendee.name
              : reminder.booking.attendees[0].name
            : reminder.booking.user?.name;

        const attendeeName =
          reminder.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE
            ? reminder.booking.user?.name
            : reminder.attendee
            ? reminder.attendee.name
            : reminder.booking.attendees[0].name;

        const timeZone =
          reminder.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE
            ? reminder.attendee
              ? reminder.attendee.timeZone
              : reminder.booking.attendees[0].timeZone
            : reminder.booking.user?.timeZone;

        const locale =
          reminder.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE ||
          reminder.workflowStep.action === WorkflowActions.SMS_ATTENDEE
            ? reminder.attendee
              ? reminder.attendee.locale
              : reminder.booking.attendees[0].locale
            : reminder.booking.user?.locale;

        let emailContent = {
          emailSubject: reminder.workflowStep.emailSubject || "",
          emailBody: `<body style="white-space: pre-wrap;">${
            reminder.workflowStep.reminderBody || ""
          }</body>`,
        };

        let emailBodyEmpty = false;

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
            eventName: reminder.booking.eventType?.title || "",
            organizerName: reminder.booking.user?.name || "",
            attendeeName: reminder.attendee ? reminder.attendee.name : reminder.booking.attendees[0].name,
            attendeeEmail: reminder.attendee ? reminder.attendee.email : reminder.booking.attendees[0].email,
            eventDate: dayjs(reminder.booking.startTime).tz(timeZone),
            eventEndTime: dayjs(reminder.booking?.endTime).tz(timeZone),
            timeZone: timeZone,
            location: reminder.booking.location || "",
            additionalNotes: reminder.booking.description,
            responses: responses,
            meetingUrl: bookingMetadataSchema.parse(reminder.booking.metadata || {})?.videoCallUrl,
            cancelLink: `${bookerUrl}/booking/${reminder.booking.uid}?cancel=true`,
            rescheduleLink: `${bookerUrl}/reschedule/${reminder.booking.uid}`,
            ratingUrl: `${bookerUrl}/booking/${reminder.booking.uid}?rating`,
            noShowUrl: `${bookerUrl}/booking/${reminder.booking.uid}?noShow=true`,
          };
          const emailLocale = locale || "en";
          const emailSubject = customTemplate(
            reminder.workflowStep.emailSubject || "",
            variables,
            emailLocale,
            getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat),
            !!reminder.booking.user?.hideBranding
          ).text;
          emailContent.emailSubject = emailSubject;
          emailContent.emailBody = customTemplate(
            reminder.workflowStep.reminderBody || "",
            variables,
            emailLocale,
            getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat),
            !!reminder.booking.user?.hideBranding
          ).html;

          emailBodyEmpty =
            customTemplate(
              reminder.workflowStep.reminderBody || "",
              variables,
              emailLocale,
              getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat)
            ).text.length === 0;
        } else if (reminder.workflowStep.template === WorkflowTemplates.REMINDER) {
          emailContent = emailReminderTemplate(
            false,
            reminder.workflowStep.action,
            getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat),
            reminder.booking.startTime.toISOString() || "",
            reminder.booking.endTime.toISOString() || "",
            reminder.booking.eventType?.title || "",
            timeZone || "",
            attendeeName || "",
            name || "",
            !!reminder.booking.user?.hideBranding
          );
        } else if (reminder.workflowStep.template === WorkflowTemplates.RATING) {
          const organizerOrganizationProfile = await prisma.profile.findFirst({
            where: {
              userId: reminder.booking.user?.id,
            },
          });

          const organizerOrganizationId = organizerOrganizationProfile?.organizationId;
          const bookerUrl = await getBookerBaseUrl(
            reminder.booking.eventType?.team?.parentId ?? organizerOrganizationId ?? null
          );
          emailContent = emailRatingTemplate({
            isEditingMode: true,
            action: reminder.workflowStep.action || WorkflowActions.EMAIL_ADDRESS,
            timeFormat: getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat),
            startTime: reminder.booking.startTime.toISOString() || "",
            endTime: reminder.booking.endTime.toISOString() || "",
            eventName: reminder.booking.eventType?.title || "",
            timeZone: timeZone || "",
            organizer: reminder.booking.user?.name || "",
            name: name || "",
            ratingUrl: `${bookerUrl}/booking/${reminder.booking.uid}?rating` || "",
            noShowUrl: `${bookerUrl}/booking/${reminder.booking.uid}?noShow=true` || "",
          });
        } else if (reminder.workflowStep.template === WorkflowTemplates.THANKYOU) {
          emailContent = emailThankYouTemplate({
            isEditingMode: false,
            timeFormat: getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat),
            startTime: reminder.booking.startTime.toISOString() || "",
            endTime: reminder.booking.endTime.toISOString() || "",
            eventName: reminder.booking.eventType?.title || "",
            timeZone,
            otherPerson: reminder.booking.user?.name || "",
            name: name || "",
          });
        }
        if (emailContent.emailSubject.length > 0 && !emailBodyEmpty && sendTo) {
          const batchId = await getBatchId();

          sendEmailPromises.push(
            sendSendgridMail(
              {
                to: sendTo,
                subject: emailContent.emailSubject,
                html: emailContent.emailBody,
                batchId: batchId,
                sendAt: dayjs(reminder.scheduledDate).unix(),
                replyTo: reminder.booking?.userPrimaryEmail ?? reminder.booking.user?.email,
                attachments: reminder.workflowStep.includeCalendarEvent
                  ? [
                      {
                        content: Buffer.from(getiCalEventAsString(reminder.booking) || "").toString("base64"),
                        filename: "event.ics",
                        type: "text/calendar; method=REQUEST",
                        disposition: "attachment",
                        contentId: uuidv4(),
                      },
                    ]
                  : undefined,
              },
              { sender: reminder.workflowStep.sender }
            )
          );

          await prisma.workflowReminder.update({
            where: {
              id: reminder.id,
            },
            data: {
              scheduled: true,
              referenceId: batchId,
            },
          });
        }
      } catch (error) {
        logger.error(`Error scheduling Email with error ${error}`);
      }
    } else if (reminder.isMandatoryReminder) {
      try {
        const sendTo = reminder.booking.attendees[0].email;
        const name = reminder.booking.attendees[0].name;
        const attendeeName = reminder.booking.user?.name;
        const timeZone = reminder.booking.attendees[0].timeZone;

        let emailContent = {
          emailSubject: "",
          emailBody: "",
        };

        const emailBodyEmpty = false;

        emailContent = emailReminderTemplate(
          false,
          WorkflowActions.EMAIL_ATTENDEE,
          getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat),
          reminder.booking.startTime.toISOString() || "",
          reminder.booking.endTime.toISOString() || "",
          reminder.booking.eventType?.title || "",
          timeZone || "",
          attendeeName || "",
          name || "",
          !!reminder.booking.user?.hideBranding
        );
        if (emailContent.emailSubject.length > 0 && !emailBodyEmpty && sendTo) {
          const batchId = await getBatchId();

          sendEmailPromises.push(
            sendSendgridMail(
              {
                to: sendTo,
                subject: emailContent.emailSubject,
                html: emailContent.emailBody,
                batchId: batchId,
                sendAt: dayjs(reminder.scheduledDate).unix(),
                replyTo: reminder.booking?.userPrimaryEmail ?? reminder.booking.user?.email,
              },
              { sender: reminder.workflowStep?.sender }
            )
          );

          await prisma.workflowReminder.update({
            where: {
              id: reminder.id,
            },
            data: {
              scheduled: true,
              referenceId: batchId,
            },
          });
        }
      } catch (error) {
        logger.error(`Error scheduling Email with error ${error}`);
      }
    }
  }

  Promise.allSettled(sendEmailPromises).then((results) => {
    results.forEach((result) => {
      if (result.status === "rejected") {
        logger.error("Email sending failed", result.reason);
      }
    });
  });
  return unscheduledReminders;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_EMAIL) {
    res.status(405).json({ message: "No SendGrid API key or email" });
    return;
  }

  //TODO:NOSHOW ,
  //the code below removes the cancel status from the "cancelled" scheduled sends,
  // which are already passed, but sendgrid says they themselves discard the
  //scheduled sends marked with "Cancelled " once their scheduled time is reached

  // // delete batch_ids with already past scheduled date from scheduled_sends
  // const remindersToDelete: { referenceId: string | null }[] = await getAllRemindersToDelete();

  // const deletePromises: Promise<any>[] = [];

  // for (const reminder of remindersToDelete) {
  //   const deletePromise = deleteScheduledSend(reminder.referenceId);
  //   deletePromises.push(deletePromise);
  // }

  // Promise.allSettled(deletePromises).then((results) => {
  //   results.forEach((result) => {
  //     if (result.status === "rejected") {
  //       logger.error(`Error deleting batch id from scheduled_sends: ${result.reason}`);
  //     }
  //   });
  // });

  //delete workflow reminders with past scheduled date
  await deletePastReminders();

  //cancel reminders for cancelled/rescheduled bookings that are scheduled within the next hour
  await invokeCancelledReminders();

  // schedule all unscheduled reminders within the next 72 hours
  const unscheduledReminders: PartialWorkflowReminder[] = await scheduleReminders();

  res.status(200).json({ message: `${unscheduledReminders.length} Emails to schedule` });
}

export default defaultHandler({
  POST: Promise.resolve({ default: handler }),
});
