import client from "@sendgrid/client";
import type { MailData } from "@sendgrid/helpers/classes/mail";
import sgMail from "@sendgrid/mail";
import { JSDOM } from "jsdom";
import { v4 as uuidv4 } from "uuid";

import { SENDER_NAME } from "@calcom/lib/constants";
import { setTestEmail } from "@calcom/lib/testEmails";

let sendgridAPIKey: string;
let senderEmail: string;

const testMode = process.env.NEXT_PUBLIC_IS_E2E || process.env.INTEGRATION_TEST_MODE;

function assertSendgrid() {
  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_EMAIL) {
    sendgridAPIKey = process.env.SENDGRID_API_KEY as string;
    senderEmail = process.env.SENDGRID_EMAIL as string;
    sgMail.setApiKey(sendgridAPIKey);
    client.setApiKey(sendgridAPIKey);
  } else {
    console.error("Sendgrid credentials are missing from the .env file");
  }
}
export async function getBatchId() {
  if (testMode) {
    return uuidv4();
  }
  assertSendgrid();
  if (!process.env.SENDGRID_API_KEY) {
    console.info("No sendgrid API key provided, returning DUMMY_BATCH_ID");
    return "DUMMY_BATCH_ID";
  }
  const batchIdResponse = await client.request({
    url: "/v3/mail/batch",
    method: "POST",
  });
  return batchIdResponse[1].batch_id as string;
}

export function sendSendgridMail(
  mailData: Partial<MailData>,
  addData: { sender?: string | null; includeCalendarEvent?: boolean },
  customArgs?: {
    [key: string]: any;
  }
) {
  assertSendgrid();

  if (testMode) {
    if (!mailData.sendAt) {
      setTestEmail({
        to: mailData.to?.toString() || "",
        from: {
          email: senderEmail,
          name: addData.sender || SENDER_NAME,
        },
        subject: mailData.subject || "",
        html: mailData.html || "",
      });
    }
    console.log(
      "Skipped Sending Email as process.env.NEXT_PUBLIC_IS_E2E or process.env.INTEGRATION_TEST_MODE is set. Emails are available in globalThis.testEmails"
    );

    return new Promise((r) => r("Skipped sendEmail for Unit Tests"));
  }

  if (!sendgridAPIKey) {
    console.info("No sendgrid API key provided, skipping email");
    return Promise.resolve();
  }
  const payload = {
    to: mailData.to,
    from: {
      email: senderEmail,
      name: addData.sender || SENDER_NAME,
    },
    subject: mailData.subject,
    html: addHTMLStyles(mailData.html),
    batchId: mailData.batchId,
    replyTo: mailData.replyTo || senderEmail,
    attachments: mailData.attachments,
    sendAt: mailData.sendAt,
    ...(customArgs && { customArgs: { ...customArgs, msgId: uuidv4() } }),
  };
  return sgMail.send(payload);
}

export function cancelScheduledEmail(referenceId: string | null) {
  if (!referenceId) {
    console.info("No referenceId provided, skip canceling email");
    return Promise.resolve();
  }

  assertSendgrid();

  return client.request({
    url: "/v3/user/scheduled_sends",
    method: "POST",
    body: {
      batch_id: referenceId,
      status: "cancel",
    },
  });
}

export function deleteScheduledSend(referenceId: string | null) {
  if (!referenceId) {
    console.info("No referenceId provided, skip deleting scheduledSend");
    return Promise.resolve();
  }

  assertSendgrid();

  return client.request({
    url: `/v3/user/scheduled_sends/${referenceId}`,
    method: "DELETE",
  });
}

function addHTMLStyles(html?: string) {
  if (!html) {
    return "";
  }
  const dom = new JSDOM(html);
  // Select all <a> tags inside <h6> elements --> only used for emojis in rating template
  const links = Array.from(dom.window.document.querySelectorAll("h6 a")).map((link) => link as HTMLElement);

  links.forEach((link) => {
    link.style.fontSize = "20px";
    link.style.textDecoration = "none";
  });

  return dom.serialize();
}
