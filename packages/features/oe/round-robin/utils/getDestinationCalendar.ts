import type { getEventTypesFromDB } from "@calcom/features/bookings/lib/handleNewBooking/getEventTypesFromDB";
import { prisma } from "@calcom/prisma";
import type { DestinationCalendar } from "@calcom/prisma/client";

import type { BookingSelectResult } from "./bookingSelect";

interface CalendarRetrievalParams {
  eventType?: Awaited<ReturnType<typeof getEventTypesFromDB>>;
  booking?: BookingSelectResult;
  newUserId?: number;
  hasOrganizerChanged: boolean;
}

export async function getDestinationCalendar(
  params: CalendarRetrievalParams
): Promise<DestinationCalendar[] | undefined> {
  const { eventType, booking, newUserId, hasOrganizerChanged } = params;

  const eventTypeCalendar = retrieveEventTypeCalendar(eventType);
  if (eventTypeCalendar) return eventTypeCalendar;

  const organizerChangedCalendar = await handleOrganizerChangeScenario(hasOrganizerChanged, newUserId);
  if (organizerChangedCalendar) return organizerChangedCalendar;

  const currentBookingCalendar = extractBookingUserCalendar(booking);
  if (currentBookingCalendar) return currentBookingCalendar;

  return undefined;
}

function retrieveEventTypeCalendar(
  eventTypeData?: Awaited<ReturnType<typeof getEventTypesFromDB>>
): DestinationCalendar[] | null {
  return eventTypeData?.destinationCalendar ? [eventTypeData.destinationCalendar] : null;
}

async function handleOrganizerChangeScenario(
  organizerHasChanged: boolean,
  replacementUserId?: number
): Promise<DestinationCalendar[] | null> {
  if (!organizerHasChanged || !replacementUserId) return null;

  const replacementUserCalendar = await fetchUserDestinationCalendar(replacementUserId);
  return replacementUserCalendar ? [replacementUserCalendar] : null;
}

async function fetchUserDestinationCalendar(userId: number): Promise<DestinationCalendar | null> {
  return await prisma.destinationCalendar.findFirst({
    where: { userId },
  });
}

function extractBookingUserCalendar(bookingData?: BookingSelectResult): DestinationCalendar[] | null {
  return bookingData?.user?.destinationCalendar ? [bookingData.user.destinationCalendar] : null;
}
