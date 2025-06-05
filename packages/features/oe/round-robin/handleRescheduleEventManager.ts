import type { DestinationCalendar } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { metadata as GoogleMeetMetadata } from "@calcom/app-store/googlevideo/_metadata";
import { MeetLocationType } from "@calcom/app-store/locations";
import EventManager from "@calcom/core/EventManager";
import type { EventManagerInitParams } from "@calcom/core/EventManager";
import { getVideoCallDetails } from "@calcom/features/bookings/lib/handleNewBooking/getVideoCallDetails";
import { getVideoCallUrlFromCalEvent } from "@calcom/lib/CalEventParser";
import logger from "@calcom/lib/logger";
import { getTranslation } from "@calcom/lib/server/i18n";
import { BookingReferenceRepository } from "@calcom/lib/server/repository/bookingReference";
import { prisma } from "@calcom/prisma";
import type { CalendarEvent, AdditionalInformation } from "@calcom/types/Calendar";

interface RescheduleConfiguration {
  evt: CalendarEvent;
  rescheduleUid: string;
  newBookingId?: number;
  changedOrganizer?: boolean;
  previousHostDestinationCalendar?: DestinationCalendar[] | null;
  initParams: EventManagerInitParams;
  bookingLocation: string | null;
  bookingId: number;
  bookingICalUID?: string | null;
  bookingMetadata?: Prisma.JsonValue;
}

interface ProcessedEventData {
  evtWithAdditionalInfo: CalendarEvent & { additionalInformation: AdditionalInformation };
}

export const handleRescheduleEventManager = async (
  config: RescheduleConfiguration
): Promise<ProcessedEventData> => {
  const {
    evt,
    rescheduleUid,
    newBookingId,
    changedOrganizer,
    previousHostDestinationCalendar,
    initParams,
    bookingLocation,
    bookingId,
    bookingICalUID,
    bookingMetadata,
  } = config;

  const loggerInstance = logger.getSubLogger({
    prefix: ["handleRescheduleEventManager", `${bookingId}`],
  });

  const eventManagerInstance = new EventManager(initParams.user, initParams?.eventTypeAppMetadata);

  const rescheduleManager = await eventManagerInstance.reschedule(
    evt,
    rescheduleUid,
    newBookingId,
    changedOrganizer,
    previousHostDestinationCalendar
  );

  const operationResults = rescheduleManager.results ?? [];

  const { metadata: videoMetadata, videoCallUrl: extractedVideoUrl } = getVideoCallDetails({
    results: operationResults,
  });

  let finalVideoCallUrl = extractedVideoUrl;
  let additionalMetadata: AdditionalInformation = videoMetadata;

  if (operationResults.length > 0) {
    await processGoogleMeetIntegration({
      results: operationResults,
      bookingLocation,
      rescheduleManager,
      loggerInstance,
    });

    const primaryEventData = extractPrimaryEventData(operationResults);
    additionalMetadata = buildEventMetadata(primaryEventData);

    finalVideoCallUrl = determineVideoCallUrl({
      metadata: additionalMetadata,
      primaryEvent: primaryEventData,
      originalEvent: evt,
      fallbackUrl: finalVideoCallUrl,
    });

    updateCalendarEventUID(evt, operationResults);
  }

  const referencesToPersist = structuredClone(rescheduleManager.referencesToCreate);

  await BookingReferenceRepository.replaceBookingReferences({
    bookingId,
    newReferencesToCreate: referencesToPersist,
  });

  await updateBookingRecord({
    bookingId,
    bookingLocation,
    evt,
    bookingICalUID,
    bookingMetadata,
    finalVideoCallUrl,
    loggerInstance,
  });

  const enrichedEvent = {
    ...evt,
    additionalInformation: additionalMetadata,
  };

  return { evtWithAdditionalInfo: enrichedEvent };
};

async function processGoogleMeetIntegration({
  results,
  bookingLocation,
  rescheduleManager,
  loggerInstance,
}: {
  results: any[];
  bookingLocation: string | null;
  rescheduleManager: Awaited<ReturnType<EventManager["reschedule"]>>;
  loggerInstance: ReturnType<typeof logger.getSubLogger>;
}) {
  if (bookingLocation !== MeetLocationType) return;

  const meetResultTemplate = {
    appName: GoogleMeetMetadata.name,
    type: "conferencing",
    uid: results[0].uid,
    originalEvent: results[0].originalEvent,
  };

  const googleCalendarIndex = rescheduleManager.referencesToCreate.findIndex(
    (reference) => reference.type === "google_calendar"
  );

  const googleCalendarResult = results[googleCalendarIndex];
  const translationService = await getTranslation("en", "common");

  if (!googleCalendarResult) {
    loggerInstance.warn("Google Calendar not installed but using Google Meet as location");
    results.push({
      ...meetResultTemplate,
      success: false,
      calWarnings: [translationService("google_meet_warning")],
    });
    return;
  }

  const meetingLink = extractGoogleMeetLink(googleCalendarResult);

  if (meetingLink) {
    results.push({ ...meetResultTemplate, success: true });
    updateGoogleMeetReferences(rescheduleManager, googleCalendarIndex, meetingLink, googleCalendarResult);
  } else {
    results.push({ ...meetResultTemplate, success: false });
  }
}

function extractGoogleMeetLink(calendarResult: any): string | null {
  return Array.isArray(calendarResult?.updatedEvent)
    ? calendarResult.updatedEvent[0]?.hangoutLink
    : calendarResult?.updatedEvent?.hangoutLink ?? calendarResult?.createdEvent?.hangoutLink;
}

function updateGoogleMeetReferences(
  manager: any,
  calendarIndex: number,
  meetingUrl: string,
  calendarResult: any
) {
  manager.referencesToCreate[calendarIndex] = {
    ...manager.referencesToCreate[calendarIndex],
    meetingUrl,
  };

  manager.referencesToCreate.push({
    type: "google_meet_video",
    meetingUrl,
    uid: calendarResult.uid,
    credentialId: manager.referencesToCreate[calendarIndex].credentialId,
  });
}

function extractPrimaryEventData(results: any[]) {
  return Array.isArray(results[0]?.updatedEvent)
    ? results[0]?.updatedEvent[0]
    : results[0]?.updatedEvent ?? results[0]?.createdEvent;
}

function buildEventMetadata(eventData: any): AdditionalInformation {
  return {
    hangoutLink: eventData?.hangoutLink,
    conferenceData: eventData?.conferenceData,
    entryPoints: eventData?.entryPoints,
  };
}

function determineVideoCallUrl({
  metadata,
  primaryEvent,
  originalEvent,
  fallbackUrl,
}: {
  metadata: AdditionalInformation;
  primaryEvent: any;
  originalEvent: CalendarEvent;
  fallbackUrl?: string;
}): string {
  return (
    metadata.hangoutLink || primaryEvent?.url || getVideoCallUrlFromCalEvent(originalEvent) || fallbackUrl
  );
}

function updateCalendarEventUID(evt: CalendarEvent, results: any[]) {
  const calendarEntry = results.find((result) => result.type.includes("_calendar"));

  evt.iCalUID = Array.isArray(calendarEntry?.updatedEvent)
    ? calendarEntry?.updatedEvent[0]?.iCalUID
    : calendarEntry?.updatedEvent?.iCalUID || undefined;
}

async function updateBookingRecord({
  bookingId,
  bookingLocation,
  evt,
  bookingICalUID,
  bookingMetadata,
  finalVideoCallUrl,
  loggerInstance,
}: {
  bookingId: number;
  bookingLocation: string | null;
  evt: CalendarEvent;
  bookingICalUID?: string | null;
  bookingMetadata?: Prisma.JsonValue;
  finalVideoCallUrl?: string;
  loggerInstance: any;
}) {
  try {
    let locationToStore = bookingLocation;
    if (bookingLocation?.startsWith("http")) {
      locationToStore = bookingLocation;
    }

    const videoMetadata = finalVideoCallUrl
      ? { videoCallUrl: getVideoCallUrlFromCalEvent(evt) || finalVideoCallUrl }
      : undefined;

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        location: locationToStore,
        iCalUID: evt.iCalUID !== bookingICalUID ? evt.iCalUID : bookingICalUID,
        metadata: {
          ...(typeof bookingMetadata === "object" && bookingMetadata),
          ...videoMetadata,
        },
      },
    });
  } catch (error) {
    loggerInstance.error("Error while updating booking metadata", JSON.stringify({ error }));
  }
}
