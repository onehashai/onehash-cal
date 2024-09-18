import { handleCalendlyImportEvent } from "@pages/api/import/calendly";
import { Inngest } from "inngest";
import { serve } from "inngest/next";

import { CALCOM_ENV, INNGEST_ID } from "@calcom/lib/constants";

export const inngestClient = new Inngest({ id: INNGEST_ID });

const handleCalendlyImportFn = inngestClient.createFunction(
  { id: `import-from-calendly-${CALCOM_ENV}`, retries: 2 },
  { event: `import-from-calendly-${CALCOM_ENV}` },
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
