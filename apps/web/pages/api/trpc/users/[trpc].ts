import { userManagementRouter } from "@calcom/features/oe/users/server/trpc-router";
import { createNextApiHandler } from "@calcom/trpc/server/createNextApiHandler";

export default createNextApiHandler(userManagementRouter);
