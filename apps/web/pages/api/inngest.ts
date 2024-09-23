import { handleCalendlyImportEvent } from "@pages/api/import/calendly";
import { Inngest } from "inngest";
import { serve } from "inngest/next";

import { INNGEST_ID } from "@calcom/lib/constants";

export const inngestClient = new Inngest({ id: INNGEST_ID });

const key = INNGEST_ID === "onehash-cal" ? "prod" : "stag";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

const handleCalendlyImportFn = inngestClient.createFunction(
  { id: `import-from-calendly-${key}`, retries: 2 },
  { event: `import-from-calendly-${key}` },
  async ({ event, step, logger }) => {
    await handleCalendlyImportEvent(
      event.data.userCalendlyIntegrationProvider,
      event.data.user,
      step,
      logger
    );
    return { message: `Import completed for userID :${event.data.user.id}` };
  }
);

// Create an API that serves zero functions
export default serve({
  client: inngestClient,
  functions: [handleCalendlyImportFn],
});
