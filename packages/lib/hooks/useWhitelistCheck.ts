import { useSession } from "next-auth/react";
import { useMemo } from "react";

import { checkIfUserWhiteListed } from "@calcom/features/flags/whitelist.config";

export function useWhitelistCheck() {
  const { data: session, status } = useSession();

  const isUserWhiteListed = useMemo(() => {
    const email = session?.user?.email;
    if (!email || status === "loading") return false;
    return checkIfUserWhiteListed(email);
  }, [session?.user?.email, status]);

  return {
    isUserWhiteListed,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    email: session?.user?.email,
  };
}
