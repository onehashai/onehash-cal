import type { Prisma } from "@prisma/client";
import type { DeepMockProxy } from "vitest-mock-extended";

import { sendSlugReplacementEmail } from "@calcom/emails/email-manager";
import { getTranslation } from "@calcom/lib/server/i18n";
import type { PrismaClient } from "@calcom/prisma";
import { SchedulingType } from "@calcom/prisma/enums";
import { _EventTypeModel } from "@calcom/prisma/zod";
import { allManagedEventTypeProps, unlockedManagedEventTypeProps } from "@calcom/prisma/zod-utils";

interface handleChildrenEventTypesProps {
  eventTypeId: number;
  profileId: number | null;
  updatedEventType: {
    schedulingType: SchedulingType | null;
    slug: string;
  };
  currentUserId: number;
  oldEventType: {
    children?: { userId: number | null }[] | null | undefined;
    team: { name: string } | null;
    workflows?: { workflowId: number }[];
  } | null;
  children:
    | {
        hidden: boolean;
        owner: {
          id: number;
          name: string;
          email: string;
          eventTypeSlugs: string[];
        };
      }[]
    | undefined;
  prisma: PrismaClient | DeepMockProxy<PrismaClient>;
  updatedValues: Prisma.EventTypeUpdateInput;
}

const deliverSlugNotificationEmails = async (
  recipients: { email: string; name: string }[],
  eventSlug: string,
  organizationName: string | null
) => {
  const translator = await getTranslation("en", "common");
  recipients.map(
    async (recipient) =>
      await sendSlugReplacementEmail({
        email: recipient.email,
        name: recipient.name,
        teamName: organizationName,
        slug: eventSlug,
        t: translator,
      })
  );
};

const validateExistingEventTypes = async ({
  updatedEventType,
  children,
  prisma,
  userIds,
  teamName,
}: Pick<handleChildrenEventTypesProps, "updatedEventType" | "children" | "prisma"> & {
  userIds: number[];
  teamName: string | null;
}) => {
  const conflictingEventTypes = children?.filter(
    (child) => child.owner.eventTypeSlugs.includes(updatedEventType.slug) && userIds.includes(child.owner.id)
  );

  if (conflictingEventTypes?.length) {
    const removedConflictingTypes = await prisma.eventType.deleteMany({
      where: {
        slug: updatedEventType.slug,
        userId: {
          in: conflictingEventTypes.map((eventType) => eventType.owner.id),
        },
      },
    });

    await deliverSlugNotificationEmails(
      conflictingEventTypes.map((eventType) => eventType.owner),
      updatedEventType.slug,
      teamName
    );

    return removedConflictingTypes;
  }
};

export default async function handleChildrenEventTypes({
  eventTypeId: parentId,
  oldEventType,
  updatedEventType,
  children,
  prisma,
  profileId,
  updatedValues,
}: handleChildrenEventTypesProps) {
  if (updatedEventType?.schedulingType !== SchedulingType.MANAGED)
    return {
      message: "No managed event type",
    };

  const retrievedEventType = await prisma.eventType.findFirst({
    where: { id: parentId },
    select: allManagedEventTypeProps,
  });

  if (!oldEventType || !retrievedEventType)
    return {
      message: "Missing event type",
    };

  const ExtendedManagedEventTypeModel = _EventTypeModel.extend({
    bookingFields: _EventTypeModel.shape.bookingFields.nullish(),
  });

  const managedEventTypePropsSchema = ExtendedManagedEventTypeModel.pick(allManagedEventTypeProps);
  const lockedManagedValues = managedEventTypePropsSchema
    .omit(unlockedManagedEventTypeProps)
    .parse(retrievedEventType);

  if (!lockedManagedValues.metadata?.managedEventConfig)
    return {
      message: "No managed event metadata",
    };

  const unrestrictedEventTypeValues = managedEventTypePropsSchema
    .pick(unlockedManagedEventTypeProps)
    .parse(retrievedEventType);

  const previousChildUserIds = oldEventType.children?.flatMap((child) => child.userId ?? []);
  const currentChildUserIds = children?.map((child) => child.owner.id);
  const removedUserIds = previousChildUserIds?.filter((id) => !currentChildUserIds?.includes(id));
  const addedUserIds = currentChildUserIds?.filter((id) => !previousChildUserIds?.includes(id));
  const existingUserIds = currentChildUserIds?.filter((id) => previousChildUserIds?.includes(id));
  const activeWorkflowIds = retrievedEventType.workflows?.map((workflow) => workflow.workflowId);

  let removedExistingEventTypes = undefined;

  if (addedUserIds?.length) {
    removedExistingEventTypes = await validateExistingEventTypes({
      updatedEventType,
      children,
      prisma,
      userIds: addedUserIds,
      teamName: oldEventType.team?.name ?? null,
    });

    await prisma.$transaction(
      addedUserIds.map((userId) => {
        return prisma.eventType.create({
          data: {
            profileId: profileId ?? null,
            ...lockedManagedValues,
            ...unrestrictedEventTypeValues,
            bookingLimits:
              (lockedManagedValues.bookingLimits as unknown as Prisma.InputJsonObject) ?? undefined,
            recurringEvent:
              (lockedManagedValues.recurringEvent as unknown as Prisma.InputJsonValue) ?? undefined,
            metadata: (lockedManagedValues.metadata as Prisma.InputJsonValue) ?? undefined,
            bookingFields: (lockedManagedValues.bookingFields as Prisma.InputJsonValue) ?? undefined,
            durationLimits: (lockedManagedValues.durationLimits as Prisma.InputJsonValue) ?? undefined,
            eventTypeColor: (lockedManagedValues.eventTypeColor as Prisma.InputJsonValue) ?? undefined,
            onlyShowFirstAvailableSlot: lockedManagedValues.onlyShowFirstAvailableSlot ?? false,
            userId,
            users: {
              connect: [{ id: userId }],
            },
            parentId,
            hidden: children?.find((child) => child.owner.id === userId)?.hidden ?? false,
            workflows: activeWorkflowIds && {
              create: activeWorkflowIds.map((workflowId) => ({ workflowId })),
            },
            rrSegmentQueryValue: undefined,
            assignRRMembersUsingSegment: false,
          },
        });
      })
    );
  }

  if (existingUserIds?.length) {
    removedExistingEventTypes = await validateExistingEventTypes({
      updatedEventType,
      children,
      prisma,
      userIds: existingUserIds,
      teamName: oldEventType.team?.name || null,
    });

    const { unlockedFields } = lockedManagedValues.metadata?.managedEventConfig;
    const unrestrictedFieldProperties = !unlockedFields
      ? {}
      : Object.keys(unlockedFields).reduce<Record<string, boolean>>((accumulator, fieldKey) => {
          const normalizedKey =
            fieldKey === "afterBufferTime"
              ? "afterEventBuffer"
              : fieldKey === "beforeBufferTime"
              ? "beforeEventBuffer"
              : fieldKey;
          accumulator[normalizedKey] = true;
          return accumulator;
        }, {});

    const modificationPayload = managedEventTypePropsSchema
      .omit(unrestrictedFieldProperties)
      .parse(retrievedEventType);
    const sanitizedUpdatePayload = Object.entries(modificationPayload)
      .filter(([propertyKey, _]) => propertyKey !== "children")
      .reduce(
        (accumulator, [propertyKey, propertyValue]) => ({ ...accumulator, [propertyKey]: propertyValue }),
        {}
      );

    const modifiedEventTypes = await prisma.$transaction(
      existingUserIds.map((userId) => {
        return prisma.eventType.update({
          where: {
            userId_parentId: {
              userId,
              parentId,
            },
          },
          data: {
            ...sanitizedUpdatePayload,
            hashedLink:
              "multiplePrivateLinks" in unrestrictedFieldProperties
                ? undefined
                : {
                    deleteMany: {},
                  },
          },
        });
      })
    );

    if (activeWorkflowIds?.length) {
      await prisma.$transaction(
        activeWorkflowIds.flatMap((workflowId) => {
          return modifiedEventTypes.map((modifiedEventType) => {
            return prisma.workflowsOnEventTypes.upsert({
              create: {
                eventTypeId: modifiedEventType.id,
                workflowId,
              },
              update: {},
              where: {
                workflowId_eventTypeId: {
                  eventTypeId: modifiedEventType.id,
                  workflowId,
                },
              },
            });
          });
        })
      );
    }
  }

  if (removedUserIds?.length) {
    await prisma.eventType.deleteMany({
      where: {
        userId: {
          in: removedUserIds,
        },
        parentId,
      },
    });
  }

  return {
    newUserIds: addedUserIds,
    oldUserIds: existingUserIds,
    deletedUserIds: removedUserIds,
    deletedExistentEventTypes: removedExistingEventTypes,
  };
}
