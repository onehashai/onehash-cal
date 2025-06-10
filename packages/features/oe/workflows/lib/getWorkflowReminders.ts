import dayjs from "@calcom/dayjs";
import prisma from "@calcom/prisma";
import type {
  Attendee,
  EventType,
  Prisma,
  User,
  WorkflowReminder,
  WorkflowStep,
} from "@calcom/prisma/client";
import { WorkflowMethods } from "@calcom/prisma/enums";

type PartialWorkflowStep =
  | (Partial<WorkflowStep> & { workflow: { userId?: number; teamId?: number } })
  | null;

type Booking = Prisma.BookingGetPayload<{
  include: {
    attendees: true;
  };
}>;

type PartialBooking =
  | (Pick<
      Booking,
      | "startTime"
      | "endTime"
      | "location"
      | "description"
      | "metadata"
      | "customInputs"
      | "responses"
      | "uid"
      | "attendees"
      | "userPrimaryEmail"
      | "smsReminderNumber"
      | "title"
      | "eventTypeId"
    > & {
      eventType:
        | (Partial<EventType> & {
            slug: string;
            team: { parentId?: number };
            hosts: { user: { email: string; destinationCalendar?: { primaryEmail: string } } }[] | undefined;
          })
        | null;
    } & {
      user: Partial<User> | null;
    })
  | null;

export type PartialWorkflowReminder = Pick<
  WorkflowReminder,
  "id" | "isMandatoryReminder" | "scheduledDate"
> & {
  booking: PartialBooking | null;
  attendee: Attendee | null;
} & { workflowStep: PartialWorkflowStep };

const BATCH_PROCESSING_SIZE = 90;

async function fetchRemindersBatch<T extends Prisma.WorkflowReminderSelect>(
  queryFilter: Prisma.WorkflowReminderWhereInput,
  selectionCriteria: T
): Promise<Array<Prisma.WorkflowReminderGetPayload<{ select: T }>>> {
  const collectedReminders: Array<Prisma.WorkflowReminderGetPayload<{ select: T }>> = [];
  let batchIndex = 0;

  while (true) {
    const currentBatch = await prisma.workflowReminder.findMany({
      where: queryFilter,
      select: selectionCriteria,
      skip: batchIndex * BATCH_PROCESSING_SIZE,
      take: BATCH_PROCESSING_SIZE,
    });

    if (currentBatch.length === 0) {
      break;
    }

    collectedReminders.push(...(currentBatch as Array<Prisma.WorkflowReminderGetPayload<{ select: T }>>));
    batchIndex++;
  }

  return collectedReminders;
}

type RemindersToDeleteType = { referenceId: string | null };

export async function getAllRemindersToDelete(): Promise<RemindersToDeleteType[]> {
  const deletionCriteria: Prisma.WorkflowReminderWhereInput = {
    method: WorkflowMethods.EMAIL,
    cancelled: true,
    scheduledDate: {
      lte: dayjs().toISOString(),
    },
  };

  const fieldSelection: Prisma.WorkflowReminderSelect = {
    referenceId: true,
  };

  const candidatesForDeletion = await fetchRemindersBatch(deletionCriteria, fieldSelection);

  return candidatesForDeletion;
}

type RemindersToCancelType = { referenceId: string | null; id: number };

export async function getAllRemindersToCancel(): Promise<RemindersToCancelType[]> {
  const cancellationCriteria: Prisma.WorkflowReminderWhereInput = {
    method: WorkflowMethods.EMAIL,
    cancelled: true,
    scheduled: true,
    scheduledDate: {
      lte: dayjs().add(1, "hour").toISOString(),
    },
  };

  const requiredFields: Prisma.WorkflowReminderSelect = {
    referenceId: true,
    id: true,
  };

  const candidatesForCancellation = await fetchRemindersBatch(cancellationCriteria, requiredFields);

  return candidatesForCancellation;
}

export const select: Prisma.WorkflowReminderSelect = {
  id: true,
  scheduledDate: true,
  isMandatoryReminder: true,
  workflowStep: {
    select: {
      action: true,
      sendTo: true,
      reminderBody: true,
      emailSubject: true,
      template: true,
      sender: true,
      includeCalendarEvent: true,
      workflow: {
        select: {
          userId: true,
          teamId: true,
        },
      },
    },
  },
  booking: {
    select: {
      startTime: true,
      endTime: true,
      location: true,
      description: true,
      smsReminderNumber: true,
      userPrimaryEmail: true,
      eventTypeId: true,
      user: {
        select: {
          email: true,
          name: true,
          timeZone: true,
          locale: true,
          username: true,
          timeFormat: true,
          hideBranding: true,
        },
      },
      metadata: true,
      uid: true,
      customInputs: true,
      responses: true,
      attendees: true,
      eventType: {
        select: {
          bookingFields: true,
          title: true,
          slug: true,
          hosts: {
            select: {
              user: {
                select: {
                  email: true,
                  destinationCalendar: {
                    select: {
                      primaryEmail: true,
                    },
                  },
                },
              },
            },
          },
          recurringEvent: true,
          team: {
            select: {
              parentId: true,
            },
          },
        },
      },
    },
  },
  attendee: {
    select: {
      name: true,
      email: true,
      timeZone: true,
    },
  },
};

export async function getAllUnscheduledReminders(): Promise<PartialWorkflowReminder[]> {
  const unscheduledCriteria: Prisma.WorkflowReminderWhereInput = {
    method: WorkflowMethods.EMAIL,
    scheduled: false,
    scheduledDate: {
      lte: dayjs().add(2, "hour").toISOString(),
    },
    OR: [{ cancelled: null }, { cancelled: false }],
  };

  const pendingReminders = (await fetchRemindersBatch(
    unscheduledCriteria,
    select
  )) as PartialWorkflowReminder[];

  return pendingReminders;
}
