import { DataTableSelectionBar } from "@calcom/features/data-table";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { ConfirmationDialogContent, Dialog, DialogTrigger, showToast } from "@calcom/ui";

import type { User } from "./MemberList";

interface BulkRemovalProps {
  users: User[];
  onRemove: () => void;
  isOrg: boolean;
  teamId: number;
}

export default function DeleteBulkTeamMembers({
  users: membersList,
  onRemove: handleRemoval,
  isOrg: organizationFlag,
  teamId: organizationId,
}: BulkRemovalProps) {
  const { t } = useLocale();
  const chosenMembers = membersList;
  const trpcUtils = trpc.useUtils();
  const removalMutation = trpc.viewer.teams.removeMember.useMutation({
    async onSuccess() {
      await trpcUtils.viewer.teams.get.invalidate();
      await trpcUtils.viewer.eventTypes.invalidate();
      await trpcUtils.viewer.organizations.listMembers.invalidate();
      await trpcUtils.viewer.organizations.getMembers.invalidate();
      showToast("Deleted Users", "success");
    },
    async onError(error) {
      showToast(error.message, "error");
    },
  });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <DataTableSelectionBar.Button icon="ban">{t("Delete")}</DataTableSelectionBar.Button>
      </DialogTrigger>
      <ConfirmationDialogContent
        variety="danger"
        title={t("remove_users_from_team")}
        confirmBtnText={t("remove")}
        isPending={removalMutation.isPending}
        onConfirm={() => {
          removalMutation.mutate({
            teamIds: [organizationId],
            memberIds: chosenMembers.map((member) => member.id),
            isOrg: organizationFlag,
          });
          handleRemoval();
        }}>
        <p className="mt-5">
          {t("remove_users_from_team_confirm", {
            userCount: chosenMembers.length,
          })}
        </p>
      </ConfirmationDialogContent>
    </Dialog>
  );
}
