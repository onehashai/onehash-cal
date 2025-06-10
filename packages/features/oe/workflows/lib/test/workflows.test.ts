import prismock from "../../../../../../tests/libs/__mocks__/prisma";

import {
  getOrganizer,
  getScenarioData,
  TestData,
  createBookingScenario,
  createOrganization,
} from "@calcom/web/test/utils/bookingScenario/bookingScenario";
import {
  expectSMSWorkflowToBeTriggered,
  expectSMSWorkflowToBeNotTriggered,
} from "@calcom/web/test/utils/bookingScenario/expects";
import { setupAndTeardown } from "@calcom/web/test/utils/bookingScenario/setupAndTeardown";

import { describe, expect, beforeAll, vi } from "vitest";

import dayjs from "@calcom/dayjs";
import { BookingStatus, WorkflowMethods, TimeUnit } from "@calcom/prisma/enums";
import {
  deleteRemindersOfActiveOnIds,
  scheduleBookingReminders,
  bookingSelect,
} from "@calcom/trpc/server/routers/viewer/workflows/util";
import { test } from "@calcom/web/test/fixtures/fixtures";

import { deleteWorkfowRemindersOfRemovedMember } from "../../../teams/lib/deleteWorkflowRemindersOfRemovedMember";

const queryFieldsForWorkflow = {
  id: true,
  userId: true,
  isActiveOnAll: true,
  trigger: true,
  time: true,
  timeUnit: true,
  team: {
    select: {
      isOrganization: true,
    },
  },
  teamId: true,
  user: {
    select: {
      teams: true,
    },
  },
  steps: true,
  activeOn: true,
  activeOnTeams: true,
};

beforeAll(() => {
  vi.setSystemTime(new Date("2024-05-20T11:59:59Z"));
});

const eventTypesMockData = [
  {
    id: 1,
    slotInterval: 30,
    length: 30,
    useEventTypeDestinationCalendarEmail: true,
    owner: 101,
    users: [
      {
        id: 101,
      },
    ],
  },
  {
    id: 2,
    slotInterval: 30,
    length: 30,
    useEventTypeDestinationCalendarEmail: true,
    owner: 101,
    users: [
      {
        id: 101,
      },
    ],
  },
];

const reservationsMockData = [
  {
    uid: "jK7Rf8iYsOpmQUw9hB1vZxP",
    eventTypeId: 1,
    userId: 101,
    status: BookingStatus.ACCEPTED,
    startTime: `2024-05-20T14:00:00.000Z`,
    endTime: `2024-05-20T14:30:00.000Z`,
    attendees: [{ email: "attendee@example.com", locale: "en" }],
  },
  {
    uid: "mL4Dx9jTkQbnWEu3pR7yNcF",
    eventTypeId: 1,
    userId: 101,
    status: BookingStatus.ACCEPTED,
    startTime: `2024-05-20T14:30:00.000Z`,
    endTime: `2024-05-20T15:00:00.000Z`,
    attendees: [{ email: "attendee@example.com", locale: "en" }],
  },
  {
    uid: "Fd9Rf8iYsOpmQUw9hB1vKd8",
    eventTypeId: 2,
    userId: 101,
    status: BookingStatus.ACCEPTED,
    startTime: `2024-06-01T04:30:00.000Z`,
    endTime: `2024-06-01T05:00:00.000Z`,
    attendees: [{ email: "attendee@example.com", locale: "en" }],
  },
  {
    uid: "Kd8Dx9jTkQbnWEu3pR7yKdl",
    eventTypeId: 2,
    userId: 101,
    status: BookingStatus.ACCEPTED,
    startTime: `2024-06-02T04:30:00.000Z`,
    endTime: `2024-06-02T05:00:00.000Z`,
    attendees: [{ email: "attendee@example.com", locale: "en" }],
  },
];

async function generateWorkflowNotifications(automationName: string) {
  const automationInstance = await prismock.workflow.findFirst({
    where: {
      name: automationName,
    },
    select: {
      steps: {
        select: {
          id: true,
          stepNumber: true,
          action: true,
          workflowId: true,
          sendTo: true,
          reminderBody: true,
          emailSubject: true,
          template: true,
          numberRequired: true,
          sender: true,
          numberVerificationPending: true,
          includeCalendarEvent: true,
        },
      },
    },
  });

  const notificationRecordsData = [
    {
      booking: {
        connect: {
          bookingUid: "jK7Rf8iYsOpmQUw9hB1vZxP",
        },
      },
      bookingUid: "jK7Rf8iYsOpmQUw9hB1vZxP",
      workflowStepId: automationInstance?.steps[0]?.id,
      method: WorkflowMethods.EMAIL,
      scheduledDate: `2024-05-22T06:00:00.000Z`,
      scheduled: false,
      retryCount: 0,
    },
    {
      booking: {
        connect: {
          bookingUid: "mL4Dx9jTkQbnWEu3pR7yNcF",
        },
      },
      bookingUid: "mL4Dx9jTkQbnWEu3pR7yNcF",
      workflowStepId: automationInstance?.steps[0]?.id,
      method: WorkflowMethods.EMAIL,
      scheduledDate: `2024-05-22T06:30:00.000Z`,
      scheduled: false,
      retryCount: 0,
    },
    {
      booking: {
        connect: {
          bookingUid: "Fd9Rf8iYsOpmQUw9hB1vKd8",
        },
      },
      bookingUid: "Fd9Rf8iYsOpmQUw9hB1vKd8",
      workflowStepId: automationInstance?.steps[0]?.id,
      method: WorkflowMethods.EMAIL,
      scheduledDate: `2024-05-22T06:30:00.000Z`,
      scheduled: false,
      retryCount: 0,
    },
    {
      booking: {
        connect: {
          bookingUid: "Kd8Dx9jTkQbnWEu3pR7yKdl",
        },
      },
      bookingUid: "Kd8Dx9jTkQbnWEu3pR7yKdl",
      workflowStepId: automationInstance?.steps[0]?.id,
      method: WorkflowMethods.EMAIL,
      scheduledDate: `2024-05-22T06:30:00.000Z`,
      scheduled: false,
      retryCount: 0,
    },
  ];

  for (const recordData of notificationRecordsData) {
    await prismock.workflowReminder.create({
      data: recordData,
    });
  }

  return automationInstance;
}

describe("deleteRemindersOfActiveOnIds", () => {
  test("should delete all reminders from removed event types", async ({}) => {
    const eventHost = getOrganizer({
      name: "Organizer",
      email: "organizer@example.com",
      id: 101,
      schedules: [TestData.schedules.IstWorkHours],
    });

    await createBookingScenario(
      getScenarioData({
        workflows: [
          {
            name: "User Workflow",
            userId: eventHost.id,
            trigger: "BEFORE_EVENT",
            time: 1,
            timeUnit: TimeUnit.HOUR,
            action: "EMAIL_HOST",
            template: "REMINDER",
            activeOn: [1],
          },
        ],
        eventTypes: eventTypesMockData,
        bookings: reservationsMockData,
        organizer: eventHost,
      })
    );

    const automationFlow = await generateWorkflowNotifications("User Workflow");

    const eliminatedActiveIds = [1];
    const currentActiveIds = [2];

    await deleteRemindersOfActiveOnIds({
      removedActiveOnIds: eliminatedActiveIds,
      workflowSteps: automationFlow?.steps || [],
      isOrg: false,
      activeOnIds: currentActiveIds,
    });

    const existingNotifications = await prismock.workflowReminder.findMany({
      select: {
        booking: {
          select: {
            eventTypeId: true,
          },
        },
      },
    });
    const persistingNotifications = existingNotifications.filter(
      (notification) => notification.booking?.userId === 101
    );

    expect(
      persistingNotifications.filter((notification) => notification.booking?.eventTypeId === 1).length
    ).toBe(0);
    expect(
      existingNotifications.filter((notification) => notification.booking?.eventTypeId === 2).length
    ).toBe(2);
  });

  test("should delete all reminders from removed event types (org workflow)", async ({}) => {
    const organizationEntity = await createOrganization({
      name: "Test Org",
      slug: "testorg",
      withTeam: true,
    });

    const eventHost = getOrganizer({
      name: "Organizer",
      email: "organizer@example.com",
      id: 101,
      defaultScheduleId: null,
      organizationId: organizationEntity.id,
      teams: [
        {
          membership: {
            accepted: true,
          },
          team: {
            id: 3,
            name: "Team 1",
            slug: "team-1",
            parentId: organizationEntity.id,
          },
        },
        {
          membership: {
            accepted: true,
          },
          team: {
            id: 4,
            name: "Team 2",
            slug: "team-2",
            parentId: organizationEntity.id,
          },
        },
      ],
      schedules: [TestData.schedules.IstMorningShift],
    });

    await createBookingScenario(
      getScenarioData({
        workflows: [
          {
            name: "Org Workflow",
            teamId: 1,
            trigger: "BEFORE_EVENT",
            action: "EMAIL_HOST",
            template: "REMINDER",
            activeOnTeams: [2, 3, 4],
          },
        ],
        eventTypes: eventTypesMockData,
        bookings: reservationsMockData,
        organizer: eventHost,
      })
    );

    const automationFlow = await generateWorkflowNotifications("Org Workflow");

    let eliminatedActiveIds = [1];
    const currentActiveIds = [2];

    await deleteRemindersOfActiveOnIds({
      removedActiveOnIds: eliminatedActiveIds,
      workflowSteps: automationFlow?.steps || [],
      isOrg: true,
      activeOnIds: currentActiveIds,
    });

    const notificationsWithSingleTeam = await prismock.workflowReminder.findMany({
      where: {
        booking: {
          userId: eventHost.id,
        },
      },
    });

    eliminatedActiveIds = [3];

    expect(notificationsWithSingleTeam.length).toBe(4);
    await deleteRemindersOfActiveOnIds({
      removedActiveOnIds: eliminatedActiveIds,
      workflowSteps: automationFlow?.steps || [],
      isOrg: true,
      activeOnIds: currentActiveIds,
    });

    const notificationsWithoutTeam = await prismock.workflowReminder.findMany({
      where: {
        booking: {
          userId: eventHost.id,
        },
      },
    });
    const persistingNotifications = notificationsWithoutTeam.filter(
      (notification) => notification.booking?.userId === 101
    );
    expect(persistingNotifications.length).toBe(0);
  });
});

describe("scheduleBookingReminders", () => {
  setupAndTeardown();

  test("schedules workflow notifications with before event trigger and email to host action", async ({}) => {
    const eventHost = getOrganizer({
      name: "Organizer",
      email: "organizer@example.com",
      id: 101,
      defaultScheduleId: null,
      schedules: [TestData.schedules.IstMorningShift],
    });

    await createBookingScenario(
      getScenarioData({
        workflows: [
          {
            name: "Workflow",
            userId: 101,
            trigger: "BEFORE_EVENT",
            action: "EMAIL_HOST",
            template: "REMINDER",
            activeOn: [],
            time: 1,
            timeUnit: TimeUnit.HOUR,
          },
        ],
        eventTypes: eventTypesMockData,
        bookings: reservationsMockData,
        organizer: eventHost,
      })
    );

    const automationFlow = await prismock.workflow.findFirst({
      select: queryFieldsForWorkflow,
    });

    const reservationRecords = await prismock.booking.findMany({
      where: {
        userId: eventHost.id,
      },
      select: bookingSelect,
    });

    expect(automationFlow).not.toBeNull();

    if (!automationFlow) return;

    await scheduleBookingReminders(
      reservationRecords,
      automationFlow.steps,
      automationFlow.time,
      automationFlow.timeUnit,
      automationFlow.trigger,
      eventHost.id,
      null
    );

    const plannedNotifications = await prismock.workflowReminder.findMany({
      where: {
        workflowStep: {
          workflowId: automationFlow.id,
        },
      },
    });
    plannedNotifications.sort((firstItem, secondItem) =>
      dayjs(firstItem.scheduledDate).isBefore(dayjs(secondItem.scheduledDate)) ? -1 : 1
    );

    const anticipatedScheduleDates = [
      new Date("2024-05-20T13:00:00.000"),
      new Date("2024-05-20T13:30:00.000Z"),
      new Date("2024-06-01T03:30:00.000Z"),
      new Date("2024-06-02T03:30:00.000Z"),
    ];

    plannedNotifications.forEach((notification, position) => {
      expect(notification.method).toBe(WorkflowMethods.EMAIL);
      if (position < 2) {
        expect(notification.scheduled).toBe(true);
      } else {
        expect(notification.scheduled).toBe(false);
      }
    });
  });

  test("schedules workflow notifications with after event trigger and email to host action", async ({}) => {
    const eventHost = getOrganizer({
      name: "Organizer",
      email: "organizer@example.com",
      id: 101,
      defaultScheduleId: null,
      schedules: [TestData.schedules.IstMorningShift],
    });

    await createBookingScenario(
      getScenarioData({
        workflows: [
          {
            name: "Workflow",
            userId: 101,
            trigger: "AFTER_EVENT",
            action: "EMAIL_HOST",
            template: "REMINDER",
            activeOn: [],
            time: 1,
            timeUnit: TimeUnit.HOUR,
          },
        ],
        eventTypes: eventTypesMockData,
        bookings: reservationsMockData,
        organizer: eventHost,
      })
    );

    const automationFlow = await prismock.workflow.findFirst({
      select: queryFieldsForWorkflow,
    });

    const reservationRecords = await prismock.booking.findMany({
      where: {
        userId: eventHost.id,
      },
      select: bookingSelect,
    });

    expect(automationFlow).not.toBeNull();

    if (!automationFlow) return;

    await scheduleBookingReminders(
      reservationRecords,
      automationFlow.steps,
      automationFlow.time,
      automationFlow.timeUnit,
      automationFlow.trigger,
      eventHost.id,
      null
    );

    const plannedNotifications = await prismock.workflowReminder.findMany({
      where: {
        workflowStep: {
          workflowId: automationFlow.id,
        },
      },
    });
    plannedNotifications.sort((firstItem, secondItem) =>
      dayjs(firstItem.scheduledDate).isBefore(dayjs(secondItem.scheduledDate)) ? -1 : 1
    );

    const anticipatedScheduleDates = [
      new Date("2024-05-20T15:30:00.000"),
      new Date("2024-05-20T16:00:00.000Z"),
      new Date("2024-06-01T06:00:00.000Z"),
      new Date("2024-06-02T06:00:00.000Z"),
    ];

    plannedNotifications.forEach((notification, position) => {
      expect(notification.method).toBe(WorkflowMethods.EMAIL);
      expect(notification.scheduled).toBe(false);
    });
  });

  test("send sms to specific number for bookings", async ({ sms }) => {
    const eventHost = getOrganizer({
      name: "Organizer",
      email: "organizer@example.com",
      id: 101,
      defaultScheduleId: null,
      schedules: [TestData.schedules.IstMorningShift],
    });

    await createBookingScenario(
      getScenarioData({
        workflows: [
          {
            name: "Workflow",
            userId: 101,
            trigger: "AFTER_EVENT",
            action: "SMS_NUMBER",
            template: "REMINDER",
            activeOn: [],
            time: 3,
            timeUnit: TimeUnit.HOUR,
            sendTo: "000",
          },
        ],
        eventTypes: eventTypesMockData,
        bookings: reservationsMockData,
        organizer: eventHost,
      })
    );

    const automationFlow = await prismock.workflow.findFirst({
      select: queryFieldsForWorkflow,
    });

    const reservationRecords = await prismock.booking.findMany({
      where: {
        userId: eventHost.id,
      },
      select: bookingSelect,
    });

    expect(automationFlow).not.toBeNull();

    if (!automationFlow) return;

    await scheduleBookingReminders(
      reservationRecords,
      automationFlow.steps,
      automationFlow.time,
      automationFlow.timeUnit,
      automationFlow.trigger,
      eventHost.id,
      null
    );

    expectSMSWorkflowToBeNotTriggered({
      sms,
      toNumber: "000",
    });

    await prismock.verifiedNumber.create({
      data: {
        userId: eventHost.id,
        phoneNumber: "000",
      },
    });

    const verifiedPhoneNumbers = await prismock.verifiedNumber.findMany();
    await scheduleBookingReminders(
      reservationRecords,
      automationFlow.steps,
      automationFlow.time,
      automationFlow.timeUnit,
      automationFlow.trigger,
      eventHost.id,
      null
    );

    expectSMSWorkflowToBeTriggered({
      sms,
      toNumber: "000",
      includedString: "2024 May 20 at 7:30pm Asia/Kolkata",
    });

    expectSMSWorkflowToBeTriggered({
      sms,
      toNumber: "000",
      includedString: "2024 May 20 at 8:00pm Asia/Kolkata",
    });

    expectSMSWorkflowToBeNotTriggered({
      sms,
      toNumber: "000",
      includedString: "2024 June 1 at 10:00am Asia/Kolkata",
    });

    expectSMSWorkflowToBeNotTriggered({
      sms,
      toNumber: "000",
      includedString: "2024 June 2 at 10:00am Asia/Kolkata",
    });

    const plannedNotifications = await prismock.workflowReminder.findMany({
      where: {
        workflowStep: {
          workflowId: automationFlow.id,
        },
      },
    });
    plannedNotifications.sort((firstItem, secondItem) =>
      dayjs(firstItem.scheduledDate).isBefore(dayjs(secondItem.scheduledDate)) ? -1 : 1
    );

    const anticipatedScheduleDates = [
      new Date("2024-05-20T17:30:00.000"),
      new Date("2024-05-20T18:00:00.000Z"),
      new Date("2024-06-01T08:00:00.000Z"),
      new Date("2024-06-02T08:00:00.000Z"),
    ];

    plannedNotifications.forEach((notification, position) => {
      expect(notification.method).toBe(WorkflowMethods.SMS);
      if (position < 2) {
        expect(notification.scheduled).toBe(true);
      } else {
        expect(notification.scheduled).toBe(false);
      }
    });
  });
});

describe("deleteWorkfowRemindersOfRemovedMember", () => {
  test("deletes all workflow reminders when member is removed from org", async ({}) => {
    const organizationEntity = await createOrganization({
      name: "Test Org",
      slug: "testorg",
      withTeam: true,
    });

    const eventHost = getOrganizer({
      name: "Organizer",
      email: "organizer@example.com",
      id: 101,
      defaultScheduleId: null,
      organizationId: organizationEntity.id,
      teams: [
        {
          membership: {
            accepted: true,
          },
          team: {
            id: 3,
            name: "Team 1",
            slug: "team-1",
            parentId: organizationEntity.id,
          },
        },
        {
          membership: {
            accepted: true,
          },
          team: {
            id: 4,
            name: "Team 2",
            slug: "team-2",
            parentId: organizationEntity.id,
          },
        },
      ],
      schedules: [TestData.schedules.IstMorningShift],
    });

    await createBookingScenario(
      getScenarioData({
        workflows: [
          {
            name: "Org Workflow",
            teamId: 1,
            trigger: "BEFORE_EVENT",
            action: "EMAIL_HOST",
            template: "REMINDER",
            activeOnTeams: [2, 3, 4],
          },
        ],
        eventTypes: eventTypesMockData,
        bookings: reservationsMockData,
        organizer: eventHost,
      })
    );

    await generateWorkflowNotifications("Org Workflow");

    await deleteWorkfowRemindersOfRemovedMember(organizationEntity, 101, true);

    const existingNotifications = await prismock.workflowReminder.findMany();
    const persistingNotifications = existingNotifications.filter(
      (notification) => notification.booking?.userId === 101
    );
    expect(persistingNotifications.length).toBe(0);
  });

  test("deletes reminders if member is removed from an org team ", async ({}) => {
    const organizationEntity = await createOrganization({
      name: "Test Org",
      slug: "testorg",
      withTeam: true,
    });

    const eventHost = getOrganizer({
      name: "Organizer",
      email: "organizer@example.com",
      id: 101,
      defaultScheduleId: null,
      organizationId: organizationEntity.id,
      teams: [
        {
          membership: {
            accepted: true,
          },
          team: {
            id: 2,
            name: "Team 1",
            slug: "team-1",
            parentId: organizationEntity.id,
          },
        },
        {
          membership: {
            accepted: true,
          },
          team: {
            id: 3,
            name: "Team 2",
            slug: "team-2",
            parentId: organizationEntity.id,
          },
        },
        {
          membership: {
            accepted: true,
          },
          team: {
            id: 4,
            name: "Team 3",
            slug: "team-3",
            parentId: organizationEntity.id,
          },
        },
      ],
      schedules: [TestData.schedules.IstMorningShift],
    });

    await createBookingScenario(
      getScenarioData({
        workflows: [
          {
            name: "Org Workflow 1",
            teamId: 1,
            trigger: "BEFORE_EVENT",
            action: "EMAIL_HOST",
            template: "REMINDER",
            activeOnTeams: [2, 3, 4],
          },
          {
            name: "Org Workflow 2",
            teamId: 1,
            trigger: "BEFORE_EVENT",
            action: "EMAIL_HOST",
            template: "REMINDER",
            activeOnTeams: [2],
          },
        ],
        eventTypes: eventTypesMockData,
        bookings: reservationsMockData,
        organizer: eventHost,
      })
    );

    await generateWorkflowNotifications("Org Workflow 1");
    await generateWorkflowNotifications("Org Workflow 2");

    const membershipRecords = await prismock.membership.findMany();

    await prismock.membership.delete({
      where: {
        userId: 101,
        teamId: 2,
      },
    });

    await deleteWorkfowRemindersOfRemovedMember({ id: 2, parentId: organizationEntity.id }, 101, false);

    const existingNotifications = await prismock.workflowReminder.findMany({
      select: {
        workflowStep: {
          select: {
            workflow: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const firstAutomationNotifications = existingNotifications.filter(
      (notification) => notification.workflowStep?.workflow.name === "Org Workflow 1"
    );
    const secondAutomationNotifications = existingNotifications.filter(
      (notification) => notification.workflowStep?.workflow.name === "Org Workflow 2"
    );

    expect(firstAutomationNotifications.length).toBe(4);
    const persistingNotifications = secondAutomationNotifications.filter(
      (notification) => notification.booking?.userId === 101
    );
    expect(persistingNotifications.length).toBe(0);
  });
});
