import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { useOrgBranding } from "@calcom/features/oe/organizations/context/provider";
import { WEBSITE_URL, IS_SELF_HOSTED } from "@calcom/lib/constants";
import type { TRPCClientErrorLike } from "@calcom/trpc/client";
import { trpc } from "@calcom/trpc/react";
import type { AppRouter } from "@calcom/trpc/server/routers/_app";

import useRouterQuery from "@lib/hooks/useRouterQuery";

interface UsernameAvailabilityFieldProps {
  onSuccessMutation?: () => void;
  onErrorMutation?: (error: TRPCClientErrorLike<AppRouter>) => void;
  setIsUsernameInvalid?: Dispatch<SetStateAction<boolean>>;
}

export const getUsernameAvailabilityComponent = (isPremium: boolean) => {
  if (isPremium)
    return dynamic(() => import("./PremiumTextfield").then((m) => m.PremiumTextfield), { ssr: false });
  return dynamic(() => import("./UsernameTextfield").then((m) => m.UsernameTextfield), { ssr: false });
};

export const UsernameAvailabilityField = ({
  onSuccessMutation,
  onErrorMutation,
  setIsUsernameInvalid,
}: UsernameAvailabilityFieldProps) => {
  const searchParams = useSearchParams();
  const [user] = trpc.viewer.me.useSuspenseQuery();
  const [currentUsernameState, setCurrentUsernameState] = useState(user.username || "");
  const { username: usernameFromQuery, setQuery: setUsernameFromQuery } = useRouterQuery("username");
  const { username: currentUsername, setQuery: setCurrentUsername } =
    searchParams?.get("username") && user.username === null
      ? { username: usernameFromQuery, setQuery: setUsernameFromQuery }
      : { username: currentUsernameState || "", setQuery: setCurrentUsernameState };
  const formMethods = useForm({
    defaultValues: {
      username: currentUsername,
    },
  });

  const UsernameAvailability = getUsernameAvailabilityComponent(!IS_SELF_HOSTED && !user.organization?.id);
  const orgBranding = useOrgBranding();

  const usernamePrefix = orgBranding
    ? orgBranding?.fullDomain.replace(/^(https?:|)\/\//, "")
    : `${WEBSITE_URL?.replace(/^(https?:|)\/\//, "")}`;

  return (
    <Controller
      control={formMethods.control}
      name="username"
      render={({ field: { ref, onChange, value } }) => {
        return (
          <UsernameAvailability
            currentUsername={currentUsername}
            setCurrentUsername={setCurrentUsername}
            inputUsernameValue={value}
            usernameRef={ref}
            setInputUsernameValue={onChange}
            onSuccessMutation={onSuccessMutation}
            onErrorMutation={onErrorMutation}
            disabled={!!user.organization?.id}
            addOnLeading={`${usernamePrefix}/`}
            setIsUsernameInvalid={setIsUsernameInvalid}
          />
        );
      }}
    />
  );
};
