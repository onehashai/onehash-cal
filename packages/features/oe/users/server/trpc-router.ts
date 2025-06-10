import { z } from "zod";

import { getOrgFullOrigin } from "@calcom/features/oe/organizations/lib/orgDomains";
import { RedirectType } from "@calcom/prisma/enums";
import { _UserModel as UserEntity } from "@calcom/prisma/zod";
import type { inferRouterOutputs } from "@calcom/trpc";
import { TRPCError } from "@calcom/trpc";
import { authedAdminProcedure } from "@calcom/trpc/server/procedures/authedProcedure";
import { router } from "@calcom/trpc/server/trpc";

export type UserManagementRouter = typeof userManagementRouter;
export type UserManagementRouterOutputs = inferRouterOutputs<UserManagementRouter>;

const userIdentifierValidation = z.object({ userId: z.coerce.number() });

const userDataValidationSchema = UserEntity.pick({
  name: true,
  email: true,
  username: true,
  bio: true,
  timeZone: true,
  weekStart: true,
  theme: true,
  defaultScheduleId: true,
  locale: true,
  timeFormat: true,
  allowDynamicBooking: true,
  identityProvider: true,
  role: true,
  avatarUrl: true,
});

const authorizedAdminWithTargetUser = authedAdminProcedure.use(async ({ ctx, next, getRawInput }) => {
  const { prisma } = ctx;
  const validationResult = userIdentifierValidation.safeParse(await getRawInput());
  if (!validationResult.success) throw new TRPCError({ code: "BAD_REQUEST", message: "User id is required" });
  const { userId: targetUserId } = validationResult.data;
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  return next({
    ctx: {
      user: ctx.user,
      targetUserEntity: targetUser,
    },
  });
});

const executeUserProfileTransaction = async (prisma: any, targetUser: any, updateData: any) => {
  return await prisma.$transaction(async (transactionClient: any) => {
    const updatedUserRecord = await transactionClient.user.update({
      where: { id: targetUser.id },
      data: updateData,
    });

    if (targetUser.movedToProfileId && updateData.username) {
      const updatedProfile = await transactionClient.profile.update({
        where: {
          id: targetUser.movedToProfileId,
        },
        data: {
          username: updateData.username,
        },
      });

      if (targetUser.username && updatedProfile.organizationId) {
        const organizationData = await prisma.team.findUnique({
          where: {
            id: updatedProfile.organizationId,
          },
          select: {
            slug: true,
          },
        });

        if (!organizationData?.slug) {
          throw new Error("Team has no attached slug.");
        }

        const organizationUrlPrefix = getOrgFullOrigin(organizationData.slug);
        const redirectTargetUrl = `${organizationUrlPrefix}/${updateData.username}`;

        await prisma.tempOrgRedirect.updateMany({
          where: {
            type: RedirectType.User,
            from: targetUser.username,
          },
          data: {
            toUrl: redirectTargetUrl,
          },
        });
      }

      return updatedUserRecord;
    }

    if (updateData.username) {
      await transactionClient.profile.updateMany({
        where: {
          userId: targetUser.id,
        },
        data: {
          username: updateData.username,
        },
      });
    }

    return updatedUserRecord;
  });
};

export const userManagementRouter = router({
  get: authorizedAdminWithTargetUser.input(userIdentifierValidation).query(async ({ ctx }) => {
    const { targetUserEntity } = ctx;
    return { user: targetUserEntity };
  }),
  list: authedAdminProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;
    const allUsers = await prisma.user.findMany();
    return allUsers;
  }),
  add: authedAdminProcedure.input(userDataValidationSchema).mutation(async ({ ctx, input }) => {
    const { prisma } = ctx;
    const createdUser = await prisma.user.create({ data: input });
    return { user: createdUser, message: `User with id: ${createdUser.id} added successfully` };
  }),
  update: authorizedAdminWithTargetUser
    .input(userDataValidationSchema.partial())
    .mutation(async ({ ctx, input }) => {
      const { prisma, targetUserEntity } = ctx;

      const modifiedUser = await executeUserProfileTransaction(prisma, targetUserEntity, input);
      return { user: modifiedUser, message: `User with id: ${modifiedUser.id} updated successfully` };
    }),
  delete: authorizedAdminWithTargetUser.input(userIdentifierValidation).mutation(async ({ ctx }) => {
    const { prisma, targetUserEntity } = ctx;
    await prisma.user.delete({ where: { id: targetUserEntity.id } });
    return { message: `User with id: ${targetUserEntity.id} deleted successfully` };
  }),
});
