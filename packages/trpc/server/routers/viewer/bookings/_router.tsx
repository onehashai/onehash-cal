import authedProcedure from "../../../procedures/authedProcedure";
import publicProcedure from "../../../procedures/publicProcedure";
import { router } from "../../../trpc";
import { ZAddGuestsInputSchema } from "./addGuests.schema";
import { ZCancelScheduledWorkflowsInputSchema } from "./cancelWorkflows.schema";
import { ZConfirmInputSchema } from "./confirm.schema";
import { ZEditLocationInputSchema } from "./editLocation.schema";
import { ZExportInputSchema } from "./export.schema";
import { ZFindInputSchema } from "./find.schema";
import { ZGetInputSchema } from "./get.schema";
import { ZGetAllInputSchema } from "./getAll.schema";
import { ZGetBookingAttendeesInputSchema } from "./getBookingAttendees.schema";
import { ZInstantBookingInputSchema } from "./getInstantBookingLocation.schema";
import { ZRequestRescheduleInputSchema } from "./requestReschedule.schema";
import { ZSaveNoteInputSchema } from "./saveNotes.schema";
import { bookingsProcedure } from "./util";

type BookingsRouterHandlerCache = {
  get?: typeof import("./get.handler").getHandler;
  getAll?: typeof import("./getAll.handler").getAllHandler;
  requestReschedule?: typeof import("./requestReschedule.handler").requestRescheduleHandler;
  editLocation?: typeof import("./editLocation.handler").editLocationHandler;
  addGuests?: typeof import("./addGuests.handler").addGuestsHandler;
  confirm?: typeof import("./confirm.handler").confirmHandler;
  getBookingAttendees?: typeof import("./getBookingAttendees.handler").getBookingAttendeesHandler;
  find?: typeof import("./find.handler").getHandler;
  getInstantBookingLocation?: typeof import("./getInstantBookingLocation.handler").getHandler;
  saveNotes?: typeof import("./saveNotes.handler").saveNoteHandler;
  cancelWorkflow?: typeof import("./cancelWorkflows.handler").cancelWorkflowHandler;
  export?: typeof import("./export.handler").exportHandler;
};

const UNSTABLE_HANDLER_CACHE: BookingsRouterHandlerCache = {};

export const bookingsRouter = router({
  get: authedProcedure.input(ZGetInputSchema).query(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.get) {
      UNSTABLE_HANDLER_CACHE.get = await import("./get.handler").then((mod) => mod.getHandler);
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.get) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.get({
      ctx,
      input,
    });
  }),

  getAll: authedProcedure.input(ZGetAllInputSchema).mutation(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.getAll) {
      UNSTABLE_HANDLER_CACHE.getAll = await import("./getAll.handler").then((mod) => mod.getAllHandler);
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.getAll) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.getAll({
      ctx,
      input,
    });
  }),

  requestReschedule: authedProcedure.input(ZRequestRescheduleInputSchema).mutation(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.requestReschedule) {
      UNSTABLE_HANDLER_CACHE.requestReschedule = await import("./requestReschedule.handler").then(
        (mod) => mod.requestRescheduleHandler
      );
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.requestReschedule) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.requestReschedule({
      ctx,
      input,
    });
  }),

  editLocation: bookingsProcedure.input(ZEditLocationInputSchema).mutation(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.editLocation) {
      UNSTABLE_HANDLER_CACHE.editLocation = await import("./editLocation.handler").then(
        (mod) => mod.editLocationHandler
      );
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.editLocation) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.editLocation({
      ctx,
      input,
    });
  }),
  addGuests: authedProcedure.input(ZAddGuestsInputSchema).mutation(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.addGuests) {
      UNSTABLE_HANDLER_CACHE.addGuests = await import("./addGuests.handler").then(
        (mod) => mod.addGuestsHandler
      );
    }
    if (!UNSTABLE_HANDLER_CACHE.addGuests) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.addGuests({
      ctx,
      input,
    });
  }),

  saveNote: bookingsProcedure.input(ZSaveNoteInputSchema).mutation(async ({ input }) => {
    if (!UNSTABLE_HANDLER_CACHE.saveNotes) {
      UNSTABLE_HANDLER_CACHE.saveNotes = await import("./saveNotes.handler").then(
        (mod) => mod.saveNoteHandler
      );
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.saveNotes) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.saveNotes({
      input,
    });
  }),

  cancelWorkflow: publicProcedure.input(ZCancelScheduledWorkflowsInputSchema).mutation(async ({ input }) => {
    if (!UNSTABLE_HANDLER_CACHE.cancelWorkflow) {
      UNSTABLE_HANDLER_CACHE.cancelWorkflow = await import("./cancelWorkflows.handler").then(
        (mod) => mod.cancelWorkflowHandler
      );
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.cancelWorkflow) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.cancelWorkflow({
      input,
    });
  }),

  confirm: authedProcedure.input(ZConfirmInputSchema).mutation(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.confirm) {
      UNSTABLE_HANDLER_CACHE.confirm = await import("./confirm.handler").then((mod) => mod.confirmHandler);
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.confirm) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.confirm({
      ctx,
      input,
    });
  }),

  getBookingAttendees: authedProcedure
    .input(ZGetBookingAttendeesInputSchema)
    .query(async ({ input, ctx }) => {
      if (!UNSTABLE_HANDLER_CACHE.getBookingAttendees) {
        UNSTABLE_HANDLER_CACHE.getBookingAttendees = await import("./getBookingAttendees.handler").then(
          (mod) => mod.getBookingAttendeesHandler
        );
      }

      // Unreachable code but required for type safety
      if (!UNSTABLE_HANDLER_CACHE.getBookingAttendees) {
        throw new Error("Failed to load handler");
      }

      return UNSTABLE_HANDLER_CACHE.getBookingAttendees({
        ctx,
        input,
      });
    }),

  find: publicProcedure.input(ZFindInputSchema).query(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.find) {
      UNSTABLE_HANDLER_CACHE.find = await import("./find.handler").then((mod) => mod.getHandler);
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.find) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.find({
      ctx,
      input,
    });
  }),

  getInstantBookingLocation: publicProcedure
    .input(ZInstantBookingInputSchema)
    .query(async ({ input, ctx }) => {
      if (!UNSTABLE_HANDLER_CACHE.getInstantBookingLocation) {
        UNSTABLE_HANDLER_CACHE.getInstantBookingLocation = await import(
          "./getInstantBookingLocation.handler"
        ).then((mod) => mod.getHandler);
      }

      // Unreachable code but required for type safety
      if (!UNSTABLE_HANDLER_CACHE.getInstantBookingLocation) {
        throw new Error("Failed to load handler");
      }

      return UNSTABLE_HANDLER_CACHE.getInstantBookingLocation({
        ctx,
        input,
      });
    }),

  export: authedProcedure.input(ZExportInputSchema).mutation(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.export) {
      UNSTABLE_HANDLER_CACHE.export = await import("./export.handler").then((mod) => mod.exportHandler);
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.export) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.export({
      ctx,
      input,
    });
  }),
});
