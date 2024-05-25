import slugify from "@calcom/lib/slugify";

import { ProfileRepository } from "./repository/profile";
import { UserRepository } from "./repository/user";
import { isUsernameReservedDueToMigration } from "./username";

export async function checkRegularUsername(_username: string, currentOrgDomain?: string | null) {
  const isCheckingUsernameInGlobalNamespace = !currentOrgDomain;
  const username = slugify(_username);

  const premium = !!process.env.NEXT_PUBLIC_IS_E2E && username.length < 5;

  const profiles = currentOrgDomain
    ? await ProfileRepository.findManyByOrgSlugOrRequestedSlug({
        orgSlug: currentOrgDomain,
        usernames: [username],
      })
    : await UserRepository.findUsersByUsername({
        usernameList: [username],
        orgSlug: null,
      });

  console.log("profiles", profiles);

  const user = profiles?.length > 0;

  if (user) {
    return {
      available: false as const,
      premium,
      message: "A user exists with that username",
    };
  }

  const isUsernameAvailable = isCheckingUsernameInGlobalNamespace
    ? !(await isUsernameReservedDueToMigration(username))
    : true;

  return {
    available: isUsernameAvailable,
    premium,
  };
}
