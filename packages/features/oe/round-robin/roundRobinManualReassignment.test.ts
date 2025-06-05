import {
  getDate,
  createBookingScenario,
  getScenarioData,
  getMockBookingAttendee,
  TestData,
  addWorkflowReminders,
} from "@calcom/web/test/utils/bookingScenario/bookingScenario";
import {
  expectBookingToBeInDatabase,
  expectSuccessfulRoundRobinReschedulingEmails,
  expectWorkflowToBeTriggered,
} from "@calcom/web/test/utils/bookingScenario/expects";
import { setupAndTeardown } from "@calcom/web/test/utils/bookingScenario/setupAndTeardown";

import { describe, vi, expect } from "vitest";

import { BookingRepository } from "@calcom/lib/server/repository/booking";
import { SchedulingType, BookingStatus, WorkflowMethods } from "@calcom/prisma/enums";
import { test } from "@calcom/web/test/fixtures/fixtures";

vi.mock("@calcom/core/EventManager");

const mockCalendarDestination = {
  integration: "test-calendar",
  externalId: "test-calendar",
};

const testUserCollection = [
  {
    id: 1,
    name: "user-1",
    timeZone: "Asia/Kolkata",
    username: "host-1",
    email: "host1@test.com",
    schedules: [TestData.schedules.IstWorkHours],
    destinationCalendar: mockCalendarDestination,
  },
  {
    id: 2,
    name: "user-2",
    timeZone: "Asia/Kolkata",
    username: "host-2",
    email: "host2@test.com",
    schedules: [TestData.schedules.IstWorkHours],
  },
  {
    id: 3,
    name: "user-3",
    timeZone: "Asia/Kolkata",
    username: "host-3",
    email: "host3@test.com",
    schedules: [TestData.schedules.IstWorkHours],
  },
];

describe("roundRobinManualReassignment test", () => {
  setupAndTeardown();

  test("manually reassign round robin organizer", async ({ emails }) => {
    const executeRoundRobinReassignment = (await import("./roundRobinManualReassignment")).default;
    const EventManagerClass = (await import("@calcom/core/EventManager")).default;

    const eventManagerMockSpy = vi.spyOn(EventManagerClass.prototype as any, "reschedule");
    eventManagerMockSpy.mockResolvedValue({ referencesToCreate: [] });

    const userParticipants = testUserCollection;
    const initialHost = userParticipants[0];
    const replacementHost = userParticipants[1];

    const { dateString: nextDayString } = getDate({ dateIncrement: 1 });
    const { dateString: followingDayString } = getDate({ dateIncrement: 2 });

    const reassignmentBookingUid = "booking-to-reassign";

    const scenarioBookingData = await createBookingScenario(
      getScenarioData({
        workflows: [
          {
            userId: initialHost.id,
            trigger: "NEW_EVENT",
            action: "EMAIL_HOST",
            template: "REMINDER",
            activeEventTypeId: 1,
          },
        ],
        eventTypes: [
          {
            id: 1,
            slug: "round-robin-event",
            schedulingType: SchedulingType.ROUND_ROBIN,
            length: 45,
            users: userParticipants.map((user) => ({ id: user.id })),
            hosts: userParticipants.map((user) => ({ userId: user.id, isFixed: false })),
          },
        ],
        bookings: [
          {
            id: 123,
            eventTypeId: 1,
            userId: initialHost.id,
            uid: reassignmentBookingUid,
            status: BookingStatus.ACCEPTED,
            startTime: `${nextDayString}T05:00:00.000Z`,
            endTime: `${nextDayString}T05:15:00.000Z`,
            attendees: [
              getMockBookingAttendee({
                id: 2,
                name: "attendee",
                email: "attendee@test.com",
                locale: "en",
                timeZone: "Asia/Kolkata",
              }),
            ],
          },
        ],
        organizer: initialHost,
        usersApartFromOrganizer: userParticipants.slice(1),
      })
    );
    await addWorkflowReminders([
      {
        bookingUid: reassignmentBookingUid,
        method: WorkflowMethods.EMAIL,
        scheduledDate: followingDayString,
        scheduled: true,
        workflowStepId: 1,
        workflowId: 1,
      },
    ]);

    await executeRoundRobinReassignment({
      bookingId: 123,
      newUserId: replacementHost.id,
      orgId: null,
      reassignedById: 1,
    });

    expect(eventManagerMockSpy).toBeCalledTimes(1);
    expect(eventManagerMockSpy).toHaveBeenCalledWith(
      expect.any(Object),
      reassignmentBookingUid,
      undefined,
      true,
      expect.arrayContaining([expect.objectContaining(mockCalendarDestination)])
    );

    expectBookingToBeInDatabase({
      uid: reassignmentBookingUid,
      userId: replacementHost.id,
    });

    expectSuccessfulRoundRobinReschedulingEmails({
      prevOrganizer: initialHost,
      newOrganizer: replacementHost,
      emails,
    });

    expectWorkflowToBeTriggered({ emailsToReceive: [replacementHost.email], emails });
  });

  test("Manually reassign round robin host with fixed host as organizer", async () => {
    const executeRoundRobinReassignment = (await import("./roundRobinManualReassignment")).default;
    const EventManagerClass = (await import("@calcom/core/EventManager")).default;

    const eventManagerMockSpy = vi.spyOn(EventManagerClass.prototype as any, "reschedule");

    const userParticipants = testUserCollection;

    const reassignmentBookingUid = "booking-to-reassign";

    const staticHost = userParticipants[0];
    const currentDynamicHost = userParticipants[1];
    const replacementHost = userParticipants[2];
    const { dateString: nextDayString } = getDate({ dateIncrement: 1 });

    await createBookingScenario(
      getScenarioData({
        workflows: [
          {
            userId: staticHost.id,
            trigger: "NEW_EVENT",
            action: "EMAIL_HOST",
            template: "REMINDER",
          },
        ],
        eventTypes: [
          {
            id: 1,
            slug: "round-robin-event",
            schedulingType: SchedulingType.ROUND_ROBIN,
            length: 45,
            users: userParticipants.map((user) => ({ id: user.id })),
            hosts: userParticipants.map((user) => ({
              userId: user.id,
              isFixed: user.id === staticHost.id,
            })),
          },
        ],
        bookings: [
          {
            id: 123,
            eventTypeId: 1,
            userId: staticHost.id,
            uid: reassignmentBookingUid,
            status: BookingStatus.ACCEPTED,
            startTime: `${nextDayString}T05:00:00.000Z`,
            endTime: `${nextDayString}T05:15:00.000Z`,
            attendees: [
              getMockBookingAttendee({
                id: 1,
                name: "attendee",
                email: "attendee@test.com",
                locale: "en",
                timeZone: "Asia/Kolkata",
              }),
              getMockBookingAttendee({
                id: currentDynamicHost.id,
                name: currentDynamicHost.name,
                email: currentDynamicHost.email,
                locale: "en",
                timeZone: currentDynamicHost.timeZone,
              }),
            ],
          },
        ],
        organizer: staticHost,
        usersApartFromOrganizer: userParticipants.slice(1),
      })
    );

    await executeRoundRobinReassignment({
      bookingId: 123,
      newUserId: replacementHost.id,
      orgId: null,
      reassignedById: 1,
    });

    expect(eventManagerMockSpy).toBeCalledTimes(1);

    expectBookingToBeInDatabase({
      uid: reassignmentBookingUid,
      userId: staticHost.id,
    });

    const participantCollection = await BookingRepository.getBookingAttendees(123);

    expect(participantCollection.some((attendee) => attendee.email === currentDynamicHost.email)).toBe(false);
    expect(participantCollection.some((attendee) => attendee.email === replacementHost.email)).toBe(true);
  });

  test("sends cancellation email to previous RR host when reassigning", async ({ emails }) => {
    const executeRoundRobinReassignment = (await import("./roundRobinManualReassignment")).default;
    const EventManagerClass = (await import("@calcom/core/EventManager")).default;

    const eventManagerMockSpy = vi.spyOn(EventManagerClass.prototype as any, "reschedule");
    eventManagerMockSpy.mockResolvedValue({ referencesToCreate: [] });

    const cancellationEmailSpy = vi.spyOn(
      await import("@calcom/emails"),
      "sendRoundRobinCancelledEmailsAndSMS"
    );

    const userParticipants = testUserCollection;
    const initialHost = userParticipants[0];
    const formerDynamicHost = userParticipants[1];
    const replacementHost = userParticipants[2];

    const { dateString: nextDayString } = getDate({ dateIncrement: 1 });

    const reassignmentWithPreviousHostUid = "booking-to-reassign-with-previous-rr-host";

    await createBookingScenario(
      getScenarioData({
        eventTypes: [
          {
            id: 1,
            slug: "round-robin-event",
            schedulingType: SchedulingType.ROUND_ROBIN,
            length: 45,
            users: userParticipants.map((user) => ({ id: user.id })),
            hosts: userParticipants.map((user) => ({ userId: user.id, isFixed: false })),
          },
        ],
        bookings: [
          {
            id: 124,
            eventTypeId: 1,
            userId: initialHost.id,
            uid: reassignmentWithPreviousHostUid,
            status: BookingStatus.ACCEPTED,
            startTime: `${nextDayString}T05:00:00.000Z`,
            endTime: `${nextDayString}T05:15:00.000Z`,
            attendees: [
              getMockBookingAttendee({
                id: 2,
                name: "attendee",
                email: "attendee@test.com",
                locale: "en",
                timeZone: "Asia/Kolkata",
              }),
              getMockBookingAttendee({
                id: formerDynamicHost.id,
                name: formerDynamicHost.name,
                email: formerDynamicHost.email,
                locale: "en",
                timeZone: formerDynamicHost.timeZone,
              }),
            ],
          },
        ],
        organizer: initialHost,
        usersApartFromOrganizer: userParticipants.slice(1),
      })
    );

    await executeRoundRobinReassignment({
      bookingId: 124,
      newUserId: replacementHost.id,
      orgId: null,
      reassignedById: 1,
    });

    expect(cancellationEmailSpy).toHaveBeenCalledTimes(1);
  });
});
