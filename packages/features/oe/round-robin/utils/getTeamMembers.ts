import type { getEventTypeResponse } from "@calcom/features/bookings/lib/handleNewBooking/getEventTypesFromDB";
import type { IsFixedAwareUser } from "@calcom/features/bookings/lib/handleNewBooking/types";
import { getTranslation } from "@calcom/lib/server/i18n";

import type { BookingSelectResult } from "./bookingSelect";

interface ParticipantData {
  name: string;
  id: number;
  email: string;
  timeZone: string;
  locale: string | null;
  bookingId: number | null;
  phoneNumber: string | null;
  noShow: boolean | null;
}

type HostUser =
  | getEventTypeResponse["hosts"][number]["user"]
  | IsFixedAwareUser
  | {
      id: number;
      email: string;
      name: string | null;
      locale: string | null;
      timeZone: string;
      username: string | null;
    };

interface TeamMemberRetrieval {
  eventTypeHosts: getEventTypeResponse["hosts"];
  attendees: ParticipantData[];
  organizer: HostUser;
  previousHost: BookingSelectResult["user"] | getEventTypeResponse["hosts"][number]["user"] | null;
  reassignedHost: getEventTypeResponse["hosts"][number]["user"];
}

interface ProcessedTeamMember {
  id: number;
  email: string;
  name: string;
  timeZone: string;
  language: {
    translate: any;
    locale: string;
  };
}

export async function getTeamMembers(params: TeamMemberRetrieval): Promise<ProcessedTeamMember[]> {
  const { eventTypeHosts, attendees, organizer, previousHost, reassignedHost } = params;

  const eligibleHosts = filterEligibleHosts({
    hosts: eventTypeHosts,
    previousHost,
    organizer,
    attendees,
  });

  const memberProcessingPromises = eligibleHosts.map((host) => buildTeamMemberData(host.user));

  const processedMembers = await Promise.all(memberProcessingPromises);

  const reassignedMember = await handleReassignedHost(reassignedHost, organizer);
  if (reassignedMember) {
    processedMembers.push(reassignedMember);
  }

  return processedMembers;
}

function filterEligibleHosts({
  hosts,
  previousHost,
  organizer,
  attendees,
}: {
  hosts: getEventTypeResponse["hosts"];
  previousHost: BookingSelectResult["user"] | getEventTypeResponse["hosts"][number]["user"] | null;
  organizer: HostUser;
  attendees: ParticipantData[];
}) {
  return hosts.filter((hostEntry) => {
    const hostUser = hostEntry.user;
    return (
      hostUser.email !== previousHost?.email &&
      hostUser.email !== organizer.email &&
      attendees.some((participant) => participant.email === hostUser.email)
    );
  });
}

async function buildTeamMemberData(
  userInfo: getEventTypeResponse["hosts"][number]["user"]
): Promise<ProcessedTeamMember> {
  const userLocale = userInfo.locale ?? "en";
  const translationFunction = await getTranslation(userLocale, "common");

  return {
    id: userInfo.id,
    email: userInfo.email,
    name: userInfo.name || "",
    timeZone: userInfo.timeZone,
    language: {
      translate: translationFunction,
      locale: userLocale,
    },
  };
}

async function handleReassignedHost(
  reassignedUser: getEventTypeResponse["hosts"][number]["user"],
  currentOrganizer: HostUser
): Promise<ProcessedTeamMember | null> {
  if (reassignedUser.email === currentOrganizer.email) return null;

  return await buildTeamMemberData(reassignedUser);
}
