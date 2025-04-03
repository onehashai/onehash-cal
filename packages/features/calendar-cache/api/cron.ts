import type { NextApiRequest } from "next";

import { HttpError } from "@calcom/lib/http-error";
import logger from "@calcom/lib/logger";
import { defaultHandler, defaultResponder } from "@calcom/lib/server";
import { SelectedCalendarRepository } from "@calcom/lib/server/repository/selectedCalendar";

import { CalendarCache } from "../calendar-cache";

const log = logger.getSubLogger({ prefix: ["/api/cron/calendar-cache-and-watch"] });

const validateRequest = (req: NextApiRequest) => {
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    log.error("Unauthorized request", { authHeader });
    throw new HttpError({ statusCode: 401, message: "Unauthorized" });
  }
};

const handleCalendarsToUnwatch = async () => {
  const calendarsToUnwatch = await SelectedCalendarRepository.getNextBatchToUnwatch();
  const result = await Promise.allSettled(
    calendarsToUnwatch.map(async (sc) => {
      if (!sc.credentialId) return;
      const cc = await CalendarCache.initFromCredentialId(sc.credentialId);
      await cc.unwatchCalendar({ calendarId: sc.externalId });
    })
  );

  return result;
};
const handleCalendarsToWatch = async () => {
  const calendarsToWatch = await SelectedCalendarRepository.getNextBatchToWatch();
  const result = await Promise.allSettled(
    calendarsToWatch.map(async (sc) => {
      if (!sc.credentialId) return;
      const cc = await CalendarCache.initFromCredentialId(sc.credentialId);
      await cc.watchCalendar({ calendarId: sc.externalId });
    })
  );

  return result;
};

// This cron is used to activate and renew calendar subcriptions
const handler = defaultResponder(async (request: NextApiRequest) => {
  try {
    log.info("Running calendar cache and watch job");
    validateRequest(request);

    //TODO: GCAL SYNC, cannot do this parallel as we are now rewatching the calendars whose webhooks are expiring and also discarding the webhook about to expire so this needs to be linear exec
    // const [watchedResult, unwatchedResult] = await Promise.all([
    //   handleCalendarsToWatch(),
    //   handleCalendarsToUnwatch(),
    // ]);

    const watchedResult = await handleCalendarsToWatch();
    const unwatchedResult = await handleCalendarsToUnwatch();
    log.info("Started to watch calendars");

    // TODO: Credentials can be installed on a whole team, check for selected calendars on the team
    return {
      succeededAt: new Date().toISOString(),
      watched: {
        successful: watchedResult.filter((x) => x.status === "fulfilled").length,
        failed: watchedResult.filter((x) => x.status === "rejected").length,
      },
      unwatched: {
        successful: unwatchedResult.filter((x) => x.status === "fulfilled").length,
        failed: unwatchedResult.filter((x) => x.status === "rejected").length,
      },
    };
  } catch (err) {
    log.error("Error in cron", err);
    throw err;
  }
});

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(handler) }),
});
