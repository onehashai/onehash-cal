import React from "react";

import classNames from "@calcom/lib/classNames";
import { getPlaceholderAvatar } from "@calcom/lib/defaultAvatarImage";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import {
  Avatar,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  showToast,
} from "@calcom/ui";

interface Props {
  team: {
    id?: number;
    name?: string | null;
    slug?: string | null;
    bio?: string | null;
    logoUrl?: string | null;
    hideBranding?: boolean | undefined;
    role: MembershipRole;
    accepted: boolean;
  };
  key: number;
  onActionSelect: (text: string) => void;
  isPending?: boolean;
  hideDropdown: boolean;
  setHideDropdown: (value: boolean) => void;
}

function TeamInviteListItem(properties: Props) {
  const localizationTools = useLocale();
  const apiUtilities = trpc.useUtils();
  const teamData = properties.team;

  const teamResponseMutation = trpc.viewer.teams.acceptOrLeave.useMutation({
    onSuccess: function () {
      showToast(localizationTools.t("success"), "success");

      const invalidationTasks = [
        apiUtilities.viewer.teams.get.invalidate(),
        apiUtilities.viewer.teams.hasTeamPlan.invalidate(),
        apiUtilities.viewer.teams.list.invalidate(),
        apiUtilities.viewer.organizations.listMembers.invalidate(),
      ];

      return Promise.all(invalidationTasks);
    },
  });

  const processTeamResponse = function (shouldAccept: boolean) {
    if (typeof teamData.id !== "number") return;

    teamResponseMutation.mutate({
      teamId: teamData.id,
      accept: shouldAccept,
    });
  };

  const handleAcceptance = function () {
    processTeamResponse(true);
  };

  const handleRejection = function () {
    processTeamResponse(false);
  };

  const userHasNotAccepted = properties.team.accepted === false;

  if (!teamData) {
    return <React.Fragment />;
  }

  const renderTeamInformation = function () {
    const avatarSource = getPlaceholderAvatar(teamData.logoUrl, teamData.name);
    const roleTranslation = localizationTools.t(teamData.role.toLocaleLowerCase());

    return (
      <div className="flex">
        <Avatar size="mdLg" imageSrc={avatarSource} alt="Team Logo" className="" />
        <div className="ms-3 inline-block">
          <span className="text-emphasis text-sm font-semibold">{teamData.name}</span>
          <span className="text-default block text-sm leading-5">
            {localizationTools.t("invited_by_team", {
              teamName: teamData.name,
              role: roleTranslation,
            })}
          </span>
        </div>
      </div>
    );
  };

  const renderDesktopActions = function () {
    return (
      <div className="hidden sm:flex">
        <Button
          type="button"
          className="border-empthasis mr-3"
          variant="icon"
          color="secondary"
          onClick={handleRejection}
          StartIcon="ban"
        />
        <Button
          type="button"
          className="border-empthasis"
          variant="icon"
          color="secondary"
          onClick={handleAcceptance}
          StartIcon="check"
        />
      </div>
    );
  };

  const renderMobileActions = function () {
    return (
      <div className="block sm:hidden">
        <Dropdown>
          <DropdownMenuTrigger asChild>
            <Button type="button" color="minimal" variant="icon" StartIcon="ellipsis" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              <DropdownItem type="button" StartIcon="check" onClick={handleAcceptance}>
                {localizationTools.t("accept")}
              </DropdownItem>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <DropdownItem color="destructive" type="button" StartIcon="x" onClick={handleRejection}>
                {localizationTools.t("reject")}
              </DropdownItem>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </Dropdown>
      </div>
    );
  };

  const actionControls = (
    <div>
      <React.Fragment>
        {renderDesktopActions()}
        {renderMobileActions()}
      </React.Fragment>
    </div>
  );

  const itemClassNames = classNames(
    "flex items-center  justify-between",
    !userHasNotAccepted && "group hover:bg-neutral-50"
  );

  const listItemElement = (
    <li className="bg-subtle border-emphasis divide-subtle divide-y rounded-md border px-5 py-4">
      <div className={itemClassNames}>
        {renderTeamInformation()}
        {actionControls}
      </div>
    </li>
  );

  return listItemElement;
}

export default TeamInviteListItem;
