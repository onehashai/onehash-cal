import type { UseFormReturn } from "react-hook-form";

import dayjs from "@calcom/dayjs";
import type { WorkflowRepository } from "@calcom/lib/server/repository/workflow";
import type { TimeFormat } from "@calcom/lib/timeFormat";
import prisma from "@calcom/prisma";
import type { PrismaClient } from "@calcom/prisma";
import type {
  Attendee,
  EventType,
  Membership,
  Prisma,
  User,
  WorkflowReminder,
  WorkflowTemplates,
} from "@calcom/prisma/client";
import type { TimeUnit, WorkflowActions, WorkflowTriggerEvents } from "@calcom/prisma/enums";
import { WorkflowMethods } from "@calcom/prisma/enums";
import type { CalEventResponses, RecurringEvent } from "@calcom/types/Calendar";

type Workflow = {
  id: number;
  name: string;
  trigger: WorkflowTriggerEvents;
  time: number | null;
  timeUnit: TimeUnit | null;
  userId: number | null;
  teamId: number | null;
  steps: WorkflowStep[];
};

type WorkflowStep = {
  workflowId: number;
  action: WorkflowActions;
  sendTo: string | null;
  template: WorkflowTemplates;
  reminderBody: string | null;
  emailSubject: string | null;
  id: number;
  sender: string | null;
  includeCalendarEvent: boolean;
  numberVerificationPending: boolean;
  numberRequired: boolean | null;
  stepNumber: number;
  disableOnMarkNoShow: boolean | null;
};

// Core types for workflow management
interface WorkflowPageProps {
  workflowData?: Awaited<ReturnType<typeof WorkflowRepository.getById>>;
  verifiedNumbers?: Awaited<ReturnType<typeof WorkflowRepository.getVerifiedNumbers>>;
  verifiedEmails?: Awaited<ReturnType<typeof WorkflowRepository.getVerifiedEmails>>;
}

interface WorkflowFormValues {
  name: string;
  activeOn: Array<{
    value: string;
    label: string;
  }>;
  steps: Array<WorkflowStep & { senderName: string | null }>;
  trigger: WorkflowTriggerEvents;
  time?: number;
  timeUnit?: TimeUnit;
  selectAll: boolean;
}

interface WorkflowActionOption {
  label: string;
  value: WorkflowActions;
  needsTeamsUpgrade: boolean;
}

interface WorkflowStepComponentProps {
  step: WorkflowStep;
  index: number;
  form: UseFormReturn<WorkflowFormValues>;
  teamId?: number;
  readOnly: boolean;
  actionOptions?: WorkflowActionOption[];
  userTimeFormat?: number;
  onRemove?: (id: number) => void;
}

// Legacy interface - kept for compatibility
interface ActionModule {
  id: number;
  sendVia: string;
  message: string;
  messageTemplate: string;
}

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
type ScheduleEmailReminderAction = Extract<
  WorkflowActions,
  "EMAIL_HOST" | "EMAIL_ATTENDEE" | "EMAIL_ADDRESS"
>;
type AttendeeInBookingInfo = {
  id?: number;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phoneNumber?: string | null;
  timeZone: string;
  language: { locale: string };
};
type BookingInfo = {
  uid?: string | null;
  bookerUrl: string;
  attendees: AttendeeInBookingInfo[];
  organizer: {
    language: { locale: string };
    name: string;
    email: string;
    timeZone: string;
    timeFormat?: TimeFormat;
    username?: string;
  };
  eventTypeId?: number | null;
  eventType: {
    title?: string;
    slug?: string;
    recurringEvent?: RecurringEvent | null;
    id?: number;
  };
  startTime: string;
  endTime: string;
  title: string;
  location?: string | null;
  additionalNotes?: string | null;
  responses?: CalEventResponses | null;
  metadata?: Prisma.JsonValue;
};
interface ScheduleReminderArgs {
  evt: BookingInfo;
  triggerEvent: WorkflowTriggerEvents;
  timeSpan: {
    time: number | null;
    timeUnit: TimeUnit | null;
  };
  template?: WorkflowTemplates;
  sender?: string | null;
  workflowStepId?: number;
  seatReferenceUid?: string;
  attendeeId?: number;
}
export type ScheduleTextReminderAction = Extract<
  WorkflowActions,
  "SMS_ATTENDEE" | "SMS_NUMBER" | "WHATSAPP_ATTENDEE" | "WHATSAPP_NUMBER"
>;
export interface ScheduleTextReminderArgs extends ScheduleReminderArgs {
  reminderPhone: string | null;
  message: string;
  action: ScheduleTextReminderAction;
  userId?: number | null;
  teamId?: number | null;
  isVerificationPending?: boolean;
  prisma?: PrismaClient;
}

type WorkflowType = Workflow & {
  team: {
    id: number;
    name: string;
    members: Membership[];
    slug: string | null;
    logo?: string | null;
  } | null;
  steps: WorkflowStep[];
  activeOnTeams?: {
    team: {
      id: number;
      name?: string | null;
    };
  }[];
  activeOn?: {
    eventType: {
      id: number;
      title: string;
      parentId: number | null;
      _count: {
        children: number;
      };
    };
  }[];
  readOnly?: boolean;
  isOrg?: boolean;
};
export type {
  Workflow,
  WorkflowType,
  WorkflowStep,
  WorkflowPageProps,
  WorkflowFormValues,
  WorkflowActionOption,
  WorkflowStepComponentProps,
  ActionModule,
  ScheduleEmailReminderAction,
  ScheduleReminderArgs,
  BookingInfo,
  AttendeeInBookingInfo,
};
