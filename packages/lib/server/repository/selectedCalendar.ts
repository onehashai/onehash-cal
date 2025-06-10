import type { Prisma } from "@prisma/client";

import { prisma } from "@calcom/prisma";
import { credentialForCalendarServiceSelect } from "@calcom/prisma/selects/credential";

export class SelectedCalendarRepository {
  static async create(data: Prisma.SelectedCalendarUncheckedCreateInput) {
    return await prisma.selectedCalendar.create({
      data: {
        ...data,
      },
    });
  }
  static async upsert(data: Prisma.SelectedCalendarUncheckedCreateInput) {
    return await prisma.selectedCalendar.upsert({
      where: {
        userId_integration_externalId: {
          userId: data.userId,
          integration: data.integration,
          externalId: data.externalId,
        },
      },
      create: { ...data },
      update: { ...data },
    });
  }
  /** Retrieve calendars that need to be watched */
  static async getNextBatchToWatch(limit = 100) {
    // Get selected calendars from users that belong to a team that has calendar cache enabled
    const oneDayInMS = 24 * 60 * 60 * 1000;
    const tomorrowTimestamp = String(new Date().getTime() + oneDayInMS);
    const nextBatch = await prisma.selectedCalendar.findMany({
      take: limit,
      where: {
        // TODO:GCAL SYNC need to get all calendars , for google calendar bi-directional sync feature
        // user: {
        //   teams: {
        //     some: {
        //       team: {
        //         features: {
        //           some: {
        //             featureId: "calendar-cache",
        //           },
        //         },
        //       },
        //     },
        //   },
        // },
        // RN we only support google calendar subscriptions for now
        integration: "google_calendar",
        googleSyncEnabled: true,
        OR: [
          // Either is a calendar pending to be watched
          { googleChannelExpiration: null },
          // Or is a calendar that is about to expire
          { googleChannelExpiration: { lt: tomorrowTimestamp } },
        ],
      },
    });
    return nextBatch;
  }
  /** Retrieve calendars that are being watched but shouldn't be anymore */
  static async getNextBatchToUnwatch(limit = 100) {
    const oneDayInMS = 24 * 60 * 60 * 1000;
    const tomorrowTimestamp = String(new Date().getTime() + oneDayInMS);
    const nextBatch = await prisma.selectedCalendar.findMany({
      take: limit,
      where: {
        // TODO:GCAL SYNC need to get all calendars , for google calendar bi-directional sync feature
        // user: {
        //   teams: {
        //     every: {
        //       team: {
        //         features: {
        //           none: {
        //             featureId: "calendar-cache",
        //           },
        //         },
        //       },
        //     },
        //   },
        // },
        // RN we only support google calendar subscriptions for now
        OR: [{ googleChannelExpiration: { lt: tomorrowTimestamp } }, { googleSyncEnabled: false }],
        integration: "google_calendar",
      },
    });
    return nextBatch;
  }
  static async delete(data: Prisma.SelectedCalendarUncheckedCreateInput) {
    return await prisma.selectedCalendar.delete({
      where: {
        userId_integration_externalId: {
          userId: data.userId,
          externalId: data.externalId,
          integration: data.integration,
        },
      },
    });
  }
  static async findMany(args: Prisma.SelectedCalendarFindManyArgs) {
    return await prisma.selectedCalendar.findMany(args);
  }
  static async findByGoogleChannelId(googleChannelId: string) {
    return await prisma.selectedCalendar.findUnique({
      where: {
        googleChannelId,
      },
      select: {
        credential: {
          select: {
            ...credentialForCalendarServiceSelect,
            selectedCalendars: {
              orderBy: {
                externalId: "asc",
              },
            },
          },
        },
        user: {
          select: {
            teams: {
              select: {
                team: {
                  select: {
                    features: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
