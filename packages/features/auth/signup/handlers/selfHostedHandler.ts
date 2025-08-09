import type { NextApiRequest, NextApiResponse } from "next";

import { hashPasswordWithSalt } from "@calcom/features/auth/lib/hashPassword";
import { sendEmailVerification } from "@calcom/features/auth/lib/verifyEmail";
import { createOrUpdateMemberships } from "@calcom/features/auth/signup/utils/createOrUpdateMemberships";
import { getUserNameFromField } from "@calcom/lib/getName";
import logger from "@calcom/lib/logger";
import { randomString } from "@calcom/lib/random";
import slugify from "@calcom/lib/slugify";
import { validateAndGetCorrectedUsernameAndEmail } from "@calcom/lib/validateUsername";
import prisma from "@calcom/prisma";
import { IdentityProvider } from "@calcom/prisma/enums";
import { signupSchema } from "@calcom/prisma/zod-utils";

import { joinAnyChildTeamOnOrgInvite } from "../utils/organization";
import { prefillAvatar } from "../utils/prefillAvatar";
import {
  findTokenByToken,
  throwIfTokenExpired,
  validateAndGetCorrectedUsernameForTeam,
} from "../utils/token";

async function checkIfUserNameTaken(user: { name: string }) {
  const username = getUserNameFromField(user.name);
  const existingUserWithUsername = await prisma.user.findFirst({
    where: {
      username,
      organizationId: null,
    },
  });
  return { existingUserWithUsername, username };
}

const usernameSlugRandom = (username: string) => `${slugify(username)}-${randomString(6).toLowerCase()}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const data = req.body;
  const { email, password, language, token } = signupSchema.parse(data);

  // const username = slugify(data.username);
  const userEmail = email.toLowerCase();

  // if (!username) {
  //   res.status(422).json({ message: "Invalid username" });
  //   return;
  // }

  let foundToken: { id: number; teamId: number | null; expires: Date } | null = null;
  // let correctedUsername = username;
  if (token) {
    foundToken = await findTokenByToken({ token });
    throwIfTokenExpired(foundToken?.expires);
    // correctedUsername =
    await validateAndGetCorrectedUsernameForTeam({
      // username,
      email: userEmail,
      teamId: foundToken?.teamId,
      isSignup: true,
    });
  } else {
    const userValidation = await validateAndGetCorrectedUsernameAndEmail({
      // username,
      email: userEmail,
      isSignup: true,
    });
    if (!userValidation.isValid) {
      logger.error("User validation failed", { userValidation });
      return res.status(409).json({ message: "Email is already taken" });
    }
    // if (!userValidation.username) {
    //   return res.status(422).json({ message: "Invalid username" });
    // }
    // correctedUsername = userValidation.username;
  }

  const { hash, salt } = hashPasswordWithSalt(password);

  const nameFromEmail = getUserNameFromField(userEmail);
  //check if user with given username already exists
  const { existingUserWithUsername, username } = await checkIfUserNameTaken({
    name: nameFromEmail,
  });
  if (foundToken && foundToken?.teamId) {
    const team = await prisma.team.findUnique({
      where: {
        id: foundToken.teamId,
      },
      include: {
        parent: {
          select: {
            id: true,
            slug: true,
            organizationSettings: true,
          },
        },
        organizationSettings: true,
      },
    });

    if (team) {
      // const isInviteForATeamInOrganization = !!team.parent;
      // const isCheckingUsernameInGlobalNamespace = !team.isOrganization && !isInviteForATeamInOrganization;

      // if (isCheckingUsernameInGlobalNamespace) {
      //   const isUsernameAvailable = !(await isUsernameReservedDueToMigration(correctedUsername));
      //   if (!isUsernameAvailable) {
      //     res.status(409).json({ message: "A user exists with that username" });
      //     return;
      //   }
      // }

      const user = await prisma.user.upsert({
        where: { email: userEmail },
        update: {
          username: existingUserWithUsername ? usernameSlugRandom(nameFromEmail) : username,
          name: nameFromEmail,
          password: {
            upsert: {
              create: { hash, salt },
              update: { hash, salt },
            },
          },
          emailVerified: new Date(Date.now()),
          identityProvider: IdentityProvider.CAL,
        },
        create: {
          username: existingUserWithUsername ? usernameSlugRandom(nameFromEmail) : username,
          email: userEmail,
          name: nameFromEmail,
          password: { create: { hash, salt } },
          identityProvider: IdentityProvider.CAL,
        },
      });

      const { membership } = await createOrUpdateMemberships({
        user,
        team,
      });

      // Accept any child team invites for orgs.
      if (team.parent) {
        await joinAnyChildTeamOnOrgInvite({
          userId: user.id,
          org: team.parent,
        });
      }
    }

    // Cleanup token after use
    await prisma.verificationToken.delete({
      where: {
        id: foundToken.id,
      },
    });
  } else {
    // const isUsernameAvailable = !(await isUsernameReservedDueToMigration(correctedUsername));
    // if (!isUsernameAvailable) {
    //   res.status(409).json({ message: "A user exists with that username" });
    //   return;
    // }
    // if (IS_PREMIUM_USERNAME_ENABLED) {
    //   const checkUsername = await checkPremiumUsername(correctedUsername);
    //   if (checkUsername.premium) {
    //     res.status(422).json({
    //       message: "Sign up from https://cal.id/signup to claim your premium username",
    //     });
    //     return;
    //   }
    // }
    await prisma.user.upsert({
      where: { email: userEmail },
      update: {
        username: existingUserWithUsername ? usernameSlugRandom(nameFromEmail) : username,
        password: {
          upsert: {
            create: { hash, salt },
            update: { hash, salt },
          },
        },
        name: nameFromEmail,
        emailVerified: new Date(Date.now()),
        identityProvider: IdentityProvider.CAL,
      },
      create: {
        username: existingUserWithUsername ? usernameSlugRandom(nameFromEmail) : username,
        email: userEmail,
        name: nameFromEmail,
        password: { create: { hash, salt } },
        identityProvider: IdentityProvider.CAL,
      },
    });

    if (process.env.AVATARAPI_USERNAME && process.env.AVATARAPI_PASSWORD) {
      await prefillAvatar({ email: userEmail });
    }

    await sendEmailVerification({
      email: userEmail,
      // username: correctedUsername,
      language,
    });
  }

  res.status(201).json({ message: "Created user" });
}
