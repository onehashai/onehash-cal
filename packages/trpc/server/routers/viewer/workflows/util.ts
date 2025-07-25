import type { Workflow as WorkflowType } from "@onehash/oe-features/workflows/config/types";
import { isSmsOrWhatsappAction } from "@onehash/oe-features/workflows/config/utils";
import { scheduleEmailReminder } from "@onehash/oe-features/workflows/managers/emailManager";
import { scheduleSMSReminder } from "@onehash/oe-features/workflows/managers/smsManager";
import { scheduleWhatsappReminder } from "@onehash/oe-features/workflows/managers/whatsappManager";
import { getAllWorkflows } from "@onehash/oe-features/workflows/utils/getWorkflows";
import type { Workflow } from "@prisma/client";
import type { z } from "zod";

import { SMS_REMINDER_NUMBER_FIELD } from "@calcom/features/bookings/lib/SystemField";
import {
  // getSmsReminderNumberField,
  getSmsReminderNumberSource,
} from "@calcom/features/bookings/lib/getBookingFields";
import { removeBookingField, upsertBookingField } from "@calcom/features/eventtypes/lib/bookingFieldsManager";
import { SENDER_ID, SENDER_NAME } from "@calcom/lib/constants";
import { getBookerBaseUrl } from "@calcom/lib/getBookerUrl/server";
import getOrgIdFromMemberOrTeamId from "@calcom/lib/getOrgIdFromMemberOrTeamId";
import { getTeamIdFromEventType } from "@calcom/lib/getTeamIdFromEventType";
import logger from "@calcom/lib/logger";
import { WorkflowRepository } from "@calcom/lib/server/repository/workflow";
import { getTimeFormatStringFromUserTimeFormat } from "@calcom/lib/timeFormat";
import prisma from "@calcom/prisma";
import type { Prisma, WorkflowStep } from "@calcom/prisma/client";
import type { TimeUnit } from "@calcom/prisma/enums";
import { SchedulingType } from "@calcom/prisma/enums";
import { BookingStatus, MembershipRole, WorkflowActions, WorkflowTriggerEvents } from "@calcom/prisma/enums";
import { EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";

import { TRPCError } from "@trpc/server";

import type { ZWorkflows } from "./getAllActiveWorkflows.schema";

const log = logger.getSubLogger({ prefix: ["workflow"] });

export const bookingSelect = {
  userPrimaryEmail: true,
  startTime: true,
  endTime: true,
  title: true,
  uid: true,
  metadata: true,
  attendees: {
    select: {
      name: true,
      email: true,
      timeZone: true,
      locale: true,
    },
  },
  eventType: {
    select: {
      slug: true,
      id: true,
      schedulingType: true,
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
    },
  },
  user: {
    select: {
      name: true,
      timeZone: true,
      timeFormat: true,
      locale: true,
      email: true,
    },
  },
};

export const verifyEmailSender = async (email: string, userId: number, teamId: number | null) => {
  const verifiedEmail = await prisma.verifiedEmail.findFirst({
    where: {
      email,
      OR: [{ userId }, { teamId }],
    },
  });

  if (verifiedEmail) {
    if (teamId) {
      if (!verifiedEmail.teamId) {
        await prisma.verifiedEmail.update({
          where: {
            id: verifiedEmail.id,
          },
          data: {
            teamId,
          },
        });
      } else if (verifiedEmail.teamId !== teamId) {
        await prisma.verifiedEmail.create({
          data: {
            email,
            userId,
            teamId,
          },
        });
      }
    }
    return;
  }

  const userEmail = await prisma.user.findFirst({
    where: {
      id: userId,
      email,
    },
  });

  if (userEmail) {
    await prisma.verifiedEmail.create({
      data: {
        email,
        userId,
        teamId,
      },
    });
    return;
  }

  if (teamId) {
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
      },
      select: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
    }

    const isTeamMember = team.members.some((member) => member.userId === userId);

    if (!isTeamMember) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this team" });
    }

    const teamMemberEmail = team.members.filter((member) => member.user.email === email);

    if (teamMemberEmail) {
      await prisma.verifiedEmail.create({
        data: {
          email,
          userId,
          teamId,
        },
      });
      return;
    }
  }

  throw new TRPCError({ code: "NOT_FOUND", message: "Email not verified" });
};

export function getSender(
  step: Pick<WorkflowStep, "action" | "sender"> & { senderName: string | null | undefined }
) {
  return isSmsOrWhatsappAction(step.action) ? step.sender || SENDER_ID : step.senderName || SENDER_NAME;
}

export async function isAuthorized(
  workflow: Pick<Workflow, "id" | "teamId" | "userId"> | null,
  currentUserId: number,
  isWriteOperation?: boolean
) {
  if (!workflow) {
    return false;
  }
  if (!isWriteOperation) {
    const userWorkflow = await prisma.workflow.findFirst({
      where: {
        id: workflow.id,
        OR: [
          { userId: currentUserId },
          {
            // for read operation every team member has access
            team: {
              members: {
                some: {
                  userId: currentUserId,
                  accepted: true,
                },
              },
            },
          },
        ],
      },
    });
    if (userWorkflow) return true;
  }

  const userWorkflow = await prisma.workflow.findFirst({
    where: {
      id: workflow.id,
      OR: [
        { userId: currentUserId },
        {
          team: {
            members: {
              some: {
                userId: currentUserId,
                accepted: true,
                //only admins can update team/org workflows
                NOT: {
                  role: MembershipRole.MEMBER,
                },
              },
            },
          },
        },
      ],
    },
  });

  if (userWorkflow) return true;

  return false;
}

export async function upsertSmsReminderFieldForEventTypes({
  activeOn,
  workflowId,
  isSmsReminderNumberRequired,
  isOrg,
}: {
  activeOn: number[];
  workflowId: number;
  isSmsReminderNumberRequired: boolean;
  isOrg: boolean;
}) {
  let allEventTypeIds = activeOn;

  if (isOrg) {
    allEventTypeIds = await getAllUserAndTeamEventTypes(activeOn);
  }

  for (const eventTypeId of allEventTypeIds) {
    await upsertBookingField(
      // getSmsReminderNumberField(),
      getSmsReminderNumberSource({
        workflowId,
        isSmsReminderNumberRequired,
      }),
      eventTypeId
    );
  }
}

export async function removeSmsReminderFieldForEventTypes({
  activeOnToRemove,
  workflowId,
  isOrg,
  activeOn,
}: {
  activeOnToRemove: number[];
  workflowId: number;
  isOrg: boolean;
  activeOn?: number[];
}) {
  let allEventTypeIds = activeOnToRemove;

  if (isOrg) {
    allEventTypeIds = await getAllUserAndTeamEventTypes(activeOnToRemove, activeOn);
  }
  for (const eventTypeId of allEventTypeIds) {
    await removeSmsReminderFieldForEventType({
      workflowId,
      eventTypeId,
    });
  }
}

export async function removeSmsReminderFieldForEventType({
  workflowId,
  eventTypeId,
}: {
  workflowId: number;
  eventTypeId: number;
}) {
  await removeBookingField(
    {
      name: SMS_REMINDER_NUMBER_FIELD,
    },
    {
      id: `${workflowId}`,
      type: "workflow",
    },
    eventTypeId
  );
}

async function getAllUserAndTeamEventTypes(teamIds: number[], notMemberOfTeamId: number[] = []) {
  const teamMembersWithEventTypes = await prisma.membership.findMany({
    where: {
      teamId: {
        in: teamIds,
      },
      user: {
        teams: {
          none: {
            team: {
              id: {
                in: notMemberOfTeamId ?? [],
              },
            },
          },
        },
      },
    },
    select: {
      user: {
        select: {
          eventTypes: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  const teamEventTypes = await prisma.eventType.findMany({
    where: {
      teamId: {
        in: teamIds,
      },
    },
  });
  const userEventTypes = teamMembersWithEventTypes?.flatMap((membership) =>
    membership.user.eventTypes.map((et) => et.id)
  );

  return teamEventTypes.map((et) => et.id).concat(userEventTypes);
}

export async function isAuthorizedToAddActiveOnIds(
  newActiveIds: number[],
  isOrg: boolean,
  teamId?: number | null,
  userId?: number | null
) {
  for (const id of newActiveIds) {
    if (isOrg) {
      const newTeam = await prisma.team.findFirst({
        where: {
          id,
        },
        select: {
          parent: true,
        },
      });
      if (newTeam?.parent?.id !== teamId) {
        return false;
      }
    } else {
      const newEventType = await prisma.eventType.findFirst({
        where: {
          id,
        },
        include: {
          users: {
            select: {
              id: true,
            },
          },
          children: true,
        },
      });

      if (newEventType) {
        if (teamId && teamId !== newEventType.teamId) {
          return false;
        }
        if (
          !teamId &&
          userId &&
          newEventType.userId !== userId &&
          !newEventType?.users.find((eventTypeUser) => eventTypeUser.id === userId)
        ) {
          return false;
        }
      }
    }
  }
  return true;
}

export async function deleteRemindersOfActiveOnIds({
  removedActiveOnIds,
  workflowSteps,
  isOrg,
  activeOnIds,
}: {
  removedActiveOnIds: number[];
  workflowSteps: WorkflowStep[];
  isOrg: boolean;
  activeOnIds?: number[];
}) {
  const remindersToDelete = !isOrg
    ? await getRemindersFromRemovedEventTypes(removedActiveOnIds, workflowSteps)
    : await WorkflowRepository.getRemindersFromRemovedTeams(removedActiveOnIds, workflowSteps, activeOnIds);
  await WorkflowRepository.deleteAllWorkflowReminders(remindersToDelete);
}

async function getRemindersFromRemovedEventTypes(removedEventTypes: number[], workflowSteps: WorkflowStep[]) {
  const remindersToDeletePromise: Prisma.PrismaPromise<
    {
      id: number;
      referenceId: string | null;
      method: string;
    }[]
  >[] = [];
  removedEventTypes.forEach((eventTypeId) => {
    const remindersToDelete = prisma.workflowReminder.findMany({
      where: {
        booking: {
          eventTypeId,
        },
        workflowStepId: {
          in: workflowSteps.map((step) => {
            return step.id;
          }),
        },
      },
      select: {
        id: true,
        referenceId: true,
        method: true,
      },
    });

    remindersToDeletePromise.push(remindersToDelete);
  });

  const remindersToDelete = (await Promise.all(remindersToDeletePromise)).flat();
  return remindersToDelete;
}

export async function scheduleWorkflowNotifications(
  activeOn: number[],
  isOrg: boolean,
  workflowSteps: Partial<WorkflowStep>[],
  time: number | null,
  timeUnit: TimeUnit | null,
  trigger: WorkflowTriggerEvents,
  userId: number,
  teamId: number | null,
  alreadyScheduledActiveOnIds?: number[]
) {
  const bookingsToScheduleNotifications = await getBookings(activeOn, isOrg, alreadyScheduledActiveOnIds);

  await scheduleBookingReminders(
    bookingsToScheduleNotifications,
    workflowSteps,
    time,
    timeUnit,
    trigger,
    userId,
    teamId,
    isOrg
  );
}

async function getBookings(activeOn: number[], isOrg: boolean, alreadyScheduledActiveOnIds: number[] = []) {
  if (activeOn.length === 0) return [];

  if (isOrg) {
    const bookingsForReminders = await prisma.booking.findMany({
      where: {
        OR: [
          {
            // bookings from team event types + children managed event types
            eventType: {
              OR: [
                {
                  teamId: {
                    in: activeOn,
                  },
                },
                {
                  teamId: null,
                  parent: {
                    teamId: {
                      in: activeOn,
                    },
                  },
                },
              ],
            },
          },
          {
            // user bookings
            user: {
              teams: {
                some: {
                  teamId: {
                    in: activeOn,
                  },
                  accepted: true,
                },
              },
            },
            eventType: {
              teamId: null,
              parentId: null, // children managed event types are handled above with team event types
            },
            // if user is already part of an already scheduled activeOn connecting reminders are already scheduled
            NOT: {
              user: {
                teams: {
                  some: {
                    teamId: {
                      in: alreadyScheduledActiveOnIds,
                    },
                  },
                },
              },
            },
          },
        ],
        status: BookingStatus.ACCEPTED,
        startTime: {
          gte: new Date(),
        },
      },
      select: bookingSelect,
    });
    return bookingsForReminders;
  } else {
    const bookingsForReminders = await prisma.booking.findMany({
      where: {
        OR: [
          { eventTypeId: { in: activeOn } },
          {
            eventType: {
              parentId: {
                in: activeOn, // child event type can not disable workflows, so this should work
              },
            },
          },
        ],
        status: BookingStatus.ACCEPTED,
        startTime: {
          gte: new Date(),
        },
      },
      select: bookingSelect,
    });
    return bookingsForReminders;
  }
}

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type Bookings = UnwrapPromise<ReturnType<typeof getBookings>>;

// some parts of  scheduleWorkflowReminders (reminderSchedule.ts) is quite similar to this code
// we should consider refactoring this to  reuse similar code snippets
export async function scheduleBookingReminders(
  bookings: Bookings,
  workflowSteps: Partial<WorkflowStep>[],
  time: number | null,
  timeUnit: TimeUnit | null,
  trigger: WorkflowTriggerEvents,
  userId: number,
  teamId: number | null,
  isOrg: boolean
) {
  if (!bookings.length) return;
  if (trigger !== WorkflowTriggerEvents.BEFORE_EVENT && trigger !== WorkflowTriggerEvents.AFTER_EVENT) return;

  const bookerUrl = await getBookerBaseUrl(isOrg ? teamId : null);

  //create reminders for all bookings for each workflow step
  const promiseSteps = workflowSteps.map(async (step) => {
    // we do not have attendees phone number (user is notified about that when setting this action)
    if (step.action == WorkflowActions.SMS_ATTENDEE || step.action == WorkflowActions.WHATSAPP_ATTENDEE)
      return;

    const promiseScheduleReminders = bookings.map(async (booking) => {
      const defaultLocale = "en";
      const bookingInfo = {
        uid: booking.uid,
        bookerUrl,
        attendees: booking.attendees.map((attendee) => {
          return {
            name: attendee.name,
            email: attendee.email,
            timeZone: attendee.timeZone,
            language: { locale: attendee.locale || defaultLocale },
          };
        }),
        organizer: booking.user
          ? {
              language: { locale: booking.user.locale || defaultLocale },
              name: booking.user.name || "",
              email: booking?.userPrimaryEmail ?? booking.user.email,
              timeZone: booking.user.timeZone,
              timeFormat: getTimeFormatStringFromUserTimeFormat(booking.user.timeFormat),
            }
          : { name: "", email: "", timeZone: "", language: { locale: "" } },
        startTime: booking.startTime?.toISOString(),
        endTime: booking.endTime?.toISOString(),
        title: booking.title,
        language: { locale: booking?.user?.locale || defaultLocale },
        eventType: {
          slug: booking.eventType?.slug || "",
          schedulingType: booking.eventType?.schedulingType,
          hosts: booking.eventType?.hosts,
        },
        metadata: booking.metadata,
      };
      if (
        step.action === WorkflowActions.EMAIL_HOST ||
        step.action === WorkflowActions.EMAIL_ATTENDEE ||
        step.action === WorkflowActions.EMAIL_ADDRESS
      ) {
        let sendTo: string[] = [];

        switch (step.action) {
          case WorkflowActions.EMAIL_HOST:
            sendTo = [bookingInfo.organizer?.email];
            const schedulingType = bookingInfo.eventType.schedulingType;
            const hosts = bookingInfo.eventType.hosts
              ?.filter((host) => bookingInfo.attendees.some((attendee) => attendee.email === host.user.email))
              .map(({ user }) => user.destinationCalendar?.primaryEmail ?? user.email);
            if (
              hosts &&
              (schedulingType === SchedulingType.ROUND_ROBIN || schedulingType === SchedulingType.COLLECTIVE)
            ) {
              sendTo = sendTo.concat(hosts);
            }
            break;
          case WorkflowActions.EMAIL_ATTENDEE:
            sendTo = bookingInfo.attendees.map((attendee) => attendee.email);
            break;
          case WorkflowActions.EMAIL_ADDRESS:
            await verifyEmailSender(step.sendTo || "", userId, teamId);
            sendTo = [step.sendTo || ""];
            break;
        }

        await scheduleEmailReminder({
          evt: bookingInfo,
          triggerEvent: trigger,
          action: step.action,
          timeSpan: {
            time,
            timeUnit,
          },
          sendTo,
          emailSubject: step.emailSubject || "",
          emailBody: step.reminderBody || "",
          template: step.template,
          sender: step.sender,
          workflowStepId: step.id,
        });
      } else if (step.action === WorkflowActions.SMS_NUMBER && step.sendTo) {
        await scheduleSMSReminder({
          evt: bookingInfo,
          reminderPhone: step.sendTo,
          triggerEvent: trigger,
          action: step.action,
          timeSpan: {
            time,
            timeUnit,
          },
          message: step.reminderBody || "",
          workflowStepId: step.id,
          template: step.template,
          sender: step.sender,
          userId: userId,
          teamId: teamId,
        });
      } else if (step.action === WorkflowActions.WHATSAPP_NUMBER && step.sendTo) {
        await scheduleWhatsappReminder({
          evt: bookingInfo,
          reminderPhone: step.sendTo,
          triggerEvent: trigger,
          action: step.action,
          timeSpan: {
            time,
            timeUnit,
          },
          message: step.reminderBody || "",
          workflowStepId: step.id || 0,
          template: step.template,
          userId: userId,
          teamId: teamId,
        });
      }
    });
    await Promise.all(promiseScheduleReminders);
  });
  return Promise.all(promiseSteps);
}

export function isStepEdited(oldStep: WorkflowStep, newStep: WorkflowStep) {
  const oldStepKeys = Object.keys(oldStep);
  const newStepKeys = Object.keys(newStep);

  if (oldStepKeys.length !== newStepKeys.length) {
    return true;
  }

  for (const key of oldStepKeys) {
    if (oldStep[key as keyof WorkflowStep] !== newStep[key as keyof WorkflowStep]) {
      return true;
    }
  }

  return false;
}

export async function getAllWorkflowsFromEventType(
  eventType: {
    workflows?: {
      workflow: WorkflowType;
    }[];
    teamId?: number | null;
    parentId?: number | null;
    parent?: {
      id?: number | null;
      teamId: number | null;
    } | null;
    metadata?: Prisma.JsonValue;
  } | null,
  userId?: number | null
) {
  if (!eventType) return [];

  const eventTypeWorkflows = eventType?.workflows?.map((workflowRel) => workflowRel.workflow) ?? [];

  const teamId = await getTeamIdFromEventType({
    eventType: {
      team: { id: eventType?.teamId ?? null },
      parentId: eventType?.parentId || eventType?.parent?.id || null,
    },
  });

  const orgId = await getOrgIdFromMemberOrTeamId({ memberId: userId, teamId });

  const isManagedEventType = !!eventType?.parent;

  const eventTypeMetadata = EventTypeMetaDataSchema.parse(eventType?.metadata || {});

  const workflowsLockedForUser = isManagedEventType
    ? !eventTypeMetadata?.managedEventConfig?.unlockedFields?.workflows
    : false;

  const allWorkflows = await getAllWorkflows(
    eventTypeWorkflows,
    userId,
    teamId,
    orgId,
    workflowsLockedForUser
  );

  return allWorkflows;
}

export const getEventTypeWorkflows = async (
  userId: number,
  eventTypeId: number
): Promise<z.infer<typeof ZWorkflows>> => {
  const workflows = await prisma.workflow.findMany({
    where: {
      OR: [
        {
          userId: userId,
        },
        {
          team: {
            members: {
              some: {
                userId: userId,
              },
            },
          },
        },
      ],
      activeOn: {
        some: {
          eventTypeId: eventTypeId,
        },
      },
    },
    select: {
      name: true,
      id: true,
      trigger: true,
      time: true,
      timeUnit: true,
      userId: true,
      teamId: true,
      team: {
        select: {
          id: true,
          slug: true,
          name: true,
          members: true,
        },
      },
      activeOn: {
        select: {
          eventType: {
            select: {
              id: true,
              title: true,
              parentId: true,
              _count: {
                select: {
                  children: true,
                },
              },
            },
          },
        },
      },
      steps: true,
    },
  });

  return workflows.map((workflow) => ({ workflow }));
};
