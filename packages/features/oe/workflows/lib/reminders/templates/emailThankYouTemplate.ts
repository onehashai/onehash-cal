import dayjs from "@calcom/dayjs";
import { APP_NAME } from "@calcom/lib/constants";
import { TimeFormat } from "@calcom/lib/timeFormat";

const emailThankYouTemplate = ({
  isEditingMode,
  timeFormat,
  startTime,
  endTime,
  eventName,
  timeZone,
  otherPerson,
  name,
}: {
  isEditingMode: boolean;
  timeFormat?: TimeFormat;
  startTime?: string;
  endTime?: string;
  eventName?: string;
  timeZone?: string;
  otherPerson?: string;
  name?: string;
}) => {
  const currentTimeFormat = timeFormat || TimeFormat.TWELVE_HOUR;
  const dateTimeFormat = `ddd, MMM D, YYYY ${currentTimeFormat}`;

  let eventDate = "";

  // If in editing mode, assign placeholders for all parameters
  if (isEditingMode) {
    eventDate = "{EVENT_DATE}";
    endTime = "{EVENT_END_TIME}";
    eventName = "{EVENT_NAME}";
    timeZone = "{TIMEZONE}";
    otherPerson = "{ORGANIZER}";
    name = "{NAME}";
  } else {
    // In normal mode, format the dates using dayjs
    eventDate = dayjs(startTime).tz(timeZone).format(dateTimeFormat);
    endTime = dayjs(endTime).tz(timeZone).format(currentTimeFormat);
  }

  const emailSubject = `Thank You for Attending: ${eventName}`;

  const introHtml = `<body>Hi${
    name ? ` ${name}` : ""
  },<br><br>We want to extend our gratitude for your attendance at the recent event.<br><br>`;

  const eventHtml = `<div><strong class="editor-text-bold">Event: </strong></div>${eventName}<br><br>`;

  const dateTimeHtml = `<div><strong class="editor-text-bold">Date & Time: </strong></div>${eventDate} - ${endTime} (${timeZone})<br><br>`;

  const attendeeHtml = `<div><strong class="editor-text-bold">Attendees: </strong></div>You & ${otherPerson}<br><br>`;

  const closingHtml = `We look forward to seeing you at future events.<br><br>Best regards,<br>The ${APP_NAME} Team`;

  const endingHtml = `</body>`;

  const emailBody = introHtml + eventHtml + dateTimeHtml + attendeeHtml + closingHtml + endingHtml;

  return { emailSubject, emailBody };
};

export default emailThankYouTemplate;
