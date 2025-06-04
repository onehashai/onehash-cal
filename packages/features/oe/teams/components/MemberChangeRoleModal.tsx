import type { SyntheticEvent } from "react";
import { useMemo, useState } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import { Button, Dialog, DialogContent, DialogFooter, Select } from "@calcom/ui";

interface RoleOption {
  label: string;
  value: MembershipRole;
}

interface RoleCacheUpdateParams {
  utils: ReturnType<typeof trpc.useUtils>;
  teamId: number;
  searchTerm: string | undefined;
  role: MembershipRole;
  memberId: number;
}

interface MemberRoleModalConfiguration {
  isOpen: boolean;
  currentMember: MembershipRole;
  memberId: number;
  teamId: number;
  initialRole: MembershipRole;
  onExit: () => void;
  searchTerm?: string;
}

export const updateRoleInCache = (params: RoleCacheUpdateParams) => {
  const { utils, teamId, searchTerm, role, memberId } = params;

  utils.viewer.teams.listMembers.setInfiniteData(
    {
      limit: 10,
      teamId,
      searchTerm,
    },
    (existingData) => {
      if (!existingData) {
        return {
          pages: [],
          pageParams: [],
        };
      }

      return {
        ...existingData,
        pages: existingData.pages.map((pageData) => ({
          ...pageData,
          members: pageData.members.map((memberData) => ({
            ...memberData,
            role: memberData.id === memberId ? role : memberData.role,
          })),
        })),
      };
    }
  );
};

const createRoleOptions = (translator: any, currentUserRole: MembershipRole) => {
  const baseOptions = [
    {
      label: translator("member"),
      value: MembershipRole.MEMBER,
    },
    {
      label: translator("admin"),
      value: MembershipRole.ADMIN,
    },
    {
      label: translator("owner"),
      value: MembershipRole.OWNER,
    },
  ];

  return baseOptions.filter(
    ({ value }) => value !== MembershipRole.OWNER || currentUserRole === MembershipRole.OWNER
  );
};

const findRoleByValue = (options: RoleOption[], targetRole: MembershipRole, translator: any): RoleOption => {
  return (
    options.find((opt) => opt.value === targetRole) || {
      label: translator("member"),
      value: MembershipRole.MEMBER,
    }
  );
};

const useRoleUpdateMutation = (config: MemberRoleModalConfiguration, queryUtils: any) => {
  return trpc.viewer.teams.changeMemberRole.useMutation({
    onMutate: async ({ teamId, memberId, role }) => {
      await queryUtils.viewer.teams.listMembers.cancel();
      const cachedData = queryUtils.viewer.teams.listMembers.getInfiniteData({
        limit: 10,
        teamId,
        searchTerm: config.searchTerm,
      });

      if (cachedData) {
        updateRoleInCache({
          utils: queryUtils,
          teamId,
          memberId,
          role,
          searchTerm: config.searchTerm,
        });
      }

      return { previousValue: cachedData };
    },
    async onSuccess() {
      await queryUtils.viewer.teams.get.invalidate();
      await queryUtils.viewer.organizations.listMembers.invalidate();
      config.onExit();
    },
    async onError(error) {
      return error;
    },
  });
};

export default function MemberChangeRoleModal(configuration: MemberRoleModalConfiguration) {
  const { t } = useLocale();
  const trpcUtils = trpc.useUtils();

  const availableRoles = useMemo(
    () => createRoleOptions(t, configuration.currentMember),
    [t, configuration.currentMember]
  );

  const [selectedRole, setSelectedRole] = useState<RoleOption>(
    findRoleByValue(availableRoles, configuration.initialRole, t)
  );

  const [validationError, setValidationError] = useState("");
  const roleUpdateMutation = useRoleUpdateMutation(configuration, trpcUtils);

  const handleRoleSubmission = (event: SyntheticEvent) => {
    event.preventDefault();
    setValidationError("");

    roleUpdateMutation.mutate(
      {
        teamId: configuration.teamId,
        memberId: configuration.memberId,
        role: selectedRole.value,
      },
      {
        onError: (error) => {
          setValidationError(error.message);
        },
      }
    );
  };

  const handleRoleSelection = (selectedOption: RoleOption | null) => {
    if (selectedOption) {
      setSelectedRole(selectedOption);
    }
  };

  return (
    <Dialog open={configuration.isOpen} onOpenChange={configuration.onExit}>
      <DialogContent type="creation">
        <>
          <div className="mb-4 sm:flex sm:items-start">
            <div className="text-center sm:text-left">
              <h3
                className="text-emphasis !font-cal text-semibold leading-20 text-xl font-medium"
                id="modal-title">
                {t("change_member_role")}
              </h3>
            </div>
          </div>
          <form onSubmit={handleRoleSubmission}>
            <div className="mb-4">
              <label className="text-default mb-2 block text-sm font-medium tracking-wide" htmlFor="role">
                {t("role")}
              </label>
              <Select
                isSearchable={false}
                options={availableRoles}
                value={selectedRole}
                onChange={handleRoleSelection}
                id="role"
                className="border-default mt-1 block w-full rounded-md text-sm"
              />
            </div>
            {validationError && (
              <p className="text-sm text-red-700">
                <span className="font-bold">Error: </span>
                {validationError}
              </p>
            )}
            <DialogFooter className="mt-12">
              <Button type="button" color="secondary" onClick={configuration.onExit}>
                {t("cancel")}
              </Button>
              <Button type="submit" color="primary" className="me-2 ms-2">
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </>
      </DialogContent>
    </Dialog>
  );
}
