import TwilioClient from "twilio";
import { v4 as uuidv4 } from "uuid";

import dayjs from "@calcom/dayjs";
import { checkSMSRateLimit } from "@calcom/lib/checkRateLimitAndThrowError";
import {
  IS_DEV,
  NGROK_URL,
  WEBAPP_URL,
  WHATSAPP_CANCELLED_SID,
  WHATSAPP_COMPLETED_SID,
  WHATSAPP_REMINDER_SID,
  WHATSAPP_RESCHEDULED_SID,
} from "@calcom/lib/constants";
import logger from "@calcom/lib/logger";
import { setTestSMS } from "@calcom/lib/testSMS";
import { getTimeFormatStringFromUserTimeFormat } from "@calcom/lib/timeFormat";
import prisma from "@calcom/prisma";
import { SMSLockState, WorkflowActions, WorkflowTemplates } from "@calcom/prisma/enums";

const log = logger.getSubLogger({ prefix: ["[twilioProvider]"] });

const testMode = process.env.NEXT_PUBLIC_IS_E2E || process.env.INTEGRATION_TEST_MODE;

function createTwilioClient() {
  if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_MESSAGING_SID) {
    return TwilioClient(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  }
  throw new Error("Twilio credentials are missing from the .env file");
}

function getDefaultSender(whatsapp = false) {
  let defaultSender = process.env.TWILIO_PHONE_NUMBER;
  if (whatsapp) {
    defaultSender = `whatsapp:${process.env.TWILIO_WHATSAPP_PHONE_NUMBER}`;
  }
  return defaultSender || "";
}

function getSMSNumber(phone: string, whatsapp = false) {
  return whatsapp ? `whatsapp:${phone}` : phone;
}

export const sendSMS = async (
  phoneNumber: string,
  body: string,
  sender: string,
  userId?: number | null,
  teamId?: number | null,
  whatsapp = false,
  template?: WorkflowTemplates,
  contentVariables?: string,
  customArgs?: {
    [key: string]: any;
  }
) => {
  log.silly("sendSMS", JSON.stringify({ phoneNumber, body, sender, userId, teamId }));

  const isSMSSendingLocked = await isLockedForSMSSending(userId, teamId);

  if (isSMSSendingLocked) {
    log.debug(`${teamId ? `Team id ${teamId} ` : `User id ${userId} `} is locked for SMS sending`);
    return;
  }

  if (testMode) {
    setTestSMS({
      to: getSMSNumber(phoneNumber, whatsapp),
      from: whatsapp ? getDefaultSender(whatsapp) : sender ? sender : getDefaultSender(),
      message: body,
    });
    console.log(
      "Skipped sending SMS because process.env.NEXT_PUBLIC_IS_E2E or process.env.INTEGRATION_TEST_MODE is set. SMS are available in globalThis.testSMS"
    );
    return;
  }

  const twilio = createTwilioClient();

  if (!teamId && userId) {
    await checkSMSRateLimit({
      identifier: `sms:user:${userId}`,
      rateLimitingType: "smsMonth",
    });
  }

  let statusCallback;
  if (customArgs) {
    const webhookUrl = `${IS_DEV ? NGROK_URL : WEBAPP_URL}/api/webhook/twilio`;
    customArgs = { ...customArgs, msgId: uuidv4(), channel: whatsapp ? "WHATSAPP" : "SMS" };
    statusCallback = `${webhookUrl}?${Object.entries(customArgs)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&")}`;
  }

  const payload: {
    messagingServiceSid: string | undefined;
    to: string;
    from: string;
    body?: string;
    contentSid?: string;
    contentVariables?: string;
    statusCallback?: string;
  } = {
    messagingServiceSid: process.env.TWILIO_MESSAGING_SID,
    to: getSMSNumber(phoneNumber, whatsapp),
    from: whatsapp ? getDefaultSender(whatsapp) : sender ? sender : getDefaultSender(),
    ...(statusCallback && { statusCallback: statusCallback }),
  };

  if (whatsapp) {
    if (contentVariables === "{}") return Promise.resolve();

    if (template) payload.contentSid = whatsappTemplateMap[template];
    payload.contentVariables = contentVariables;
  } else {
    payload.body = body;
  }
  const response = await twilio.messages.create(payload);
  return response;
};

export const scheduleSMS = async (
  phoneNumber: string,
  body: string,
  scheduledDate: Date,
  sender: string,
  userId?: number | null,
  teamId?: number | null,
  whatsapp = false,
  template?: WorkflowTemplates,
  contentVariables?: string,
  customArgs?: {
    [key: string]: any;
  }
) => {
  const isSMSSendingLocked = await isLockedForSMSSending(userId, teamId);

  if (isSMSSendingLocked) {
    log.debug(`${teamId ? `Team id ${teamId} ` : `User id ${userId} `} is locked for SMS sending `);
    return;
  }

  if (testMode) {
    setTestSMS({
      to: getSMSNumber(phoneNumber, whatsapp),
      from: whatsapp ? getDefaultSender(whatsapp) : sender ? sender : getDefaultSender(),
      message: body,
    });
    console.log(
      "Skipped sending SMS because process.env.NEXT_PUBLIC_IS_E2E or process.env.INTEGRATION_TEST_MODE is set. SMS are available in globalThis.testSMS"
    );
    return { sid: uuidv4() };
  }

  const twilio = createTwilioClient();

  if (!teamId && userId) {
    await checkSMSRateLimit({
      identifier: `sms:user:${userId}`,
      rateLimitingType: "smsMonth",
    });
  }

  let statusCallback;
  if (customArgs) {
    const webhookUrl = `${IS_DEV ? NGROK_URL : WEBAPP_URL}/api/webhook/twilio`;
    customArgs = { ...customArgs, msgId: uuidv4(), channel: whatsapp ? "WHATSAPP" : "SMS" };
    statusCallback = `${webhookUrl}?${Object.entries(customArgs)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&")}`;
  }
  const payload: {
    messagingServiceSid: string | undefined;
    to: string;
    scheduleType: "fixed";
    sendAt: Date;
    from: string;
    body?: string;
    contentSid?: string;
    contentVariables?: string;
    statusCallback?: string;
  } = {
    messagingServiceSid: process.env.TWILIO_MESSAGING_SID,
    to: getSMSNumber(phoneNumber, whatsapp),
    scheduleType: "fixed",
    sendAt: scheduledDate,
    from: whatsapp ? getDefaultSender(whatsapp) : sender ? sender : getDefaultSender(),
    ...(statusCallback && { statusCallback: statusCallback }),
  };
  if (whatsapp) {
    if (contentVariables === "{}") return Promise.resolve();
    payload.contentVariables = contentVariables;
    if (template) {
      payload.contentSid = whatsappTemplateMap[template];
    }
  } else {
    payload.body = body;
  }
  const response = await twilio.messages.create(payload);
  return response;
};

export const cancelSMS = async (referenceId: string) => {
  const twilio = createTwilioClient();
  await twilio.messages(referenceId).update({ status: "canceled" });
};

export const sendVerificationCode = async (phoneNumber: string) => {
  const twilio = createTwilioClient();
  if (process.env.TWILIO_VERIFY_SID) {
    await twilio.verify
      .services(process.env.TWILIO_VERIFY_SID)
      .verifications.create({ to: phoneNumber, channel: "sms" });
  }
};

export const verifyNumber = async (phoneNumber: string, code: string) => {
  const twilio = createTwilioClient();
  if (process.env.TWILIO_VERIFY_SID) {
    try {
      const verification_check = await twilio.verify.v2
        .services(process.env.TWILIO_VERIFY_SID)
        .verificationChecks.create({ to: phoneNumber, code: code });
      return verification_check.status;
    } catch (e) {
      return "failed";
    }
  }
};

async function isLockedForSMSSending(userId?: number | null, teamId?: number | null) {
  if (teamId) {
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
      },
    });
    return team?.smsLockState === SMSLockState.LOCKED;
  }

  if (userId) {
    const memberships = await prisma.membership.findMany({
      where: {
        userId: userId,
      },
      select: {
        team: {
          select: {
            smsLockState: true,
          },
        },
      },
    });

    const memberOfLockedTeam = memberships.find(
      (membership) => membership.team.smsLockState === SMSLockState.LOCKED
    );

    if (!!memberOfLockedTeam) {
      return true;
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
    });
    return user?.smsLockState === SMSLockState.LOCKED;
  }
}

export const whatsappTemplateMap: Partial<Record<WorkflowTemplates, string>> = {
  [WorkflowTemplates.REMINDER]: WHATSAPP_REMINDER_SID,
  [WorkflowTemplates.CANCELLED]: WHATSAPP_CANCELLED_SID,
  [WorkflowTemplates.RESCHEDULED]: WHATSAPP_RESCHEDULED_SID,
  [WorkflowTemplates.COMPLETED]: WHATSAPP_COMPLETED_SID,
};

export const generateContentVars = (
  reminder: {
    workflowStep: { action?: WorkflowActions; template?: WorkflowTemplates };
    booking: {
      eventType: { title?: string } | null;
      startTime: Date;
      user: { locale?: string | null; timeFormat?: number | null } | null;
    };
  },
  attendeeName: string,
  userName: string,
  timeZone: string
): Record<number, string> => {
  const { workflowStep, booking } = reminder;
  const formatDate = (date?: Date, format?: string) =>
    dayjs(date?.toISOString() || "")
      .tz(timeZone)
      .locale(booking?.user?.locale || "en")
      .format(format || "YYYY MMM D");

  const baseVars = {
    1: workflowStep?.action === WorkflowActions.WHATSAPP_ATTENDEE ? attendeeName : userName,
    2: booking?.eventType?.title || "",
    3: workflowStep?.action === WorkflowActions.WHATSAPP_ATTENDEE ? userName : attendeeName,
    4: formatDate(booking?.startTime, "YYYY MMM D"),
    5: `${formatDate(
      booking?.startTime,
      getTimeFormatStringFromUserTimeFormat(booking?.user?.timeFormat)
    )} ${timeZone}`,
    // 6: timeZone,
  };

  switch (workflowStep?.template) {
    case WorkflowTemplates.REMINDER:
    case WorkflowTemplates.CANCELLED:
    case WorkflowTemplates.RESCHEDULED:
      return baseVars;
    case WorkflowTemplates.COMPLETED:
      return {
        1: baseVars[1],
        2: baseVars[2],
        3: baseVars[4], // Start Date
        4: baseVars[5], // Start Time
        // 5: baseVars[6], // Time Zone
      };
    default:
      return {};
  }
};
