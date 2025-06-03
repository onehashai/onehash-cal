import type { PropsWithChildren } from "react";
import { useState } from "react";

import { useFlagMap } from "@calcom/features/flags/context/provider";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useParamsWithFallback } from "@calcom/lib/hooks/useParamsWithFallback";
import { trpc } from "@calcom/trpc";
import { Button, showToast, Tooltip } from "@calcom/ui";

const GoogleWorkspaceIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clip-path="url(#clip0_4178_176214)">
      <path
        d="M8.31875 15.36C4.26 15.36 0.9575 12.0588 0.9575 8.00001C0.9575 3.94126 4.26 0.640015 8.31875 0.640015C10.1575 0.640015 11.9175 1.32126 13.2763 2.55876L13.5238 2.78501L11.0963 5.21251L10.8713 5.02001C10.1588 4.41001 9.2525 4.07376 8.31875 4.07376C6.15375 4.07376 4.39125 5.83501 4.39125 8.00001C4.39125 10.165 6.15375 11.9263 8.31875 11.9263C9.88 11.9263 11.1138 11.1288 11.695 9.77001H7.99875V6.45626L15.215 6.46626L15.2688 6.72001C15.645 8.50626 15.3438 11.1338 13.8188 13.0138C12.5563 14.57 10.7063 15.36 8.31875 15.36Z"
        fill="#6B7280"
      />
    </g>
    <defs>
      <clipPath id="clip0_4178_176214">
        <rect width="16" height="16" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

const navigateToUrl = (targetUrl: string, openInNewTab?: boolean) => {
  if (openInNewTab) {
    window.open(targetUrl, "_blank");
  } else {
    window.location.href = targetUrl;
  }
};

const performWorkspaceConnection = async (
  teamIdentifier: number,
  setLoadingState: (loading: boolean) => void
) => {
  setLoadingState(true);

  const queryParameters = new URLSearchParams({
    teamId: teamIdentifier.toString(),
  });

  try {
    const response = await fetch(`/api/teams/googleworkspace/add?${queryParameters}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Something went wrong");
    }

    const responseData = await response.json();
    navigateToUrl(responseData.url, responseData.newTab);
  } finally {
    setLoadingState(false);
  }
};

export function GoogleWorkspaceInviteButton(
  props: PropsWithChildren<{ onSuccess: (data: string[]) => void }>
) {
  const flagsConfiguration = useFlagMap();
  const trpcUtilities = trpc.useUtils();
  const { t } = useLocale();
  const routeParams = useParamsWithFallback();
  const currentTeamId = Number(routeParams.id);
  const [isWorkspaceConnectionLoading, setIsWorkspaceConnectionLoading] = useState(false);

  const { data: workspaceCredential } = trpc.viewer.googleWorkspace.checkForGWorkspace.useQuery();
  const { data: isGoogleCalendarInstalled } = trpc.viewer.appsRouter.checkGlobalKeys.useQuery({
    slug: "google-calendar",
  });

  const workspaceUsersFetcher = trpc.viewer.googleWorkspace.getUsersFromGWorkspace.useMutation({
    onSuccess: (responseData) => {
      if (Array.isArray(responseData) && responseData.length !== 0) {
        props.onSuccess(responseData);
      }
    },
  });

  const connectionRemovalHandler =
    trpc.viewer.googleWorkspace.removeCurrentGoogleWorkspaceConnection.useMutation({
      onSuccess: () => {
        showToast(t("app_removed_successfully"), "success");
      },
    });

  const isFeatureEnabled =
    flagsConfiguration["google-workspace-directory"] !== false && isGoogleCalendarInstalled;

  if (!isFeatureEnabled) {
    return null;
  }

  const hasValidCredential = workspaceCredential?.id;

  if (hasValidCredential) {
    const handleWorkspaceImport = () => {
      workspaceUsersFetcher.mutate();
    };

    const handleConnectionRemoval = () => {
      connectionRemovalHandler.mutate();
      trpcUtilities.viewer.googleWorkspace.checkForGWorkspace.invalidate();
    };

    return (
      <div className="flex gap-2">
        <Tooltip content={t("google_workspace_admin_tooltip")}>
          <Button
            color="secondary"
            onClick={handleWorkspaceImport}
            className="w-full justify-center gap-2"
            StartIcon="users"
            loading={workspaceUsersFetcher.isPending}>
            {t("import_from_google_workspace")}
          </Button>
        </Tooltip>
        <Tooltip content="Remove workspace connection">
          <Button
            color="secondary"
            loading={connectionRemovalHandler.isPending}
            StartIcon="x"
            onClick={handleConnectionRemoval}
            variant="icon"
          />
        </Tooltip>
      </div>
    );
  }

  const initiateWorkspaceConnection = () => {
    performWorkspaceConnection(currentTeamId, setIsWorkspaceConnectionLoading);
  };

  return (
    <Button
      type="button"
      color="secondary"
      loading={isWorkspaceConnectionLoading}
      CustomStartIcon={<GoogleWorkspaceIcon />}
      onClick={initiateWorkspaceConnection}
      className="justify-center gap-2">
      {t("connect_google_workspace")}
    </Button>
  );
}
