import { Dialog } from "@onehash/oe-features/ui";
import type { Dispatch, SetStateAction } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { HttpError } from "@calcom/lib/http-error";
import { trpc } from "@calcom/trpc/react";
import { showToast } from "@calcom/ui";

// Import your Dialog component here

interface WorkflowDeleteDialogProps {
  isOpenDialog: boolean;
  setIsOpenDialog: Dispatch<SetStateAction<boolean>>;
  workflowId: number;
  additionalFunction: () => Promise<boolean | void>;
}

export const WorkflowDeleteDialog = ({
  isOpenDialog,
  setIsOpenDialog,
  workflowId,
  additionalFunction,
}: WorkflowDeleteDialogProps) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const deleteMutation = trpc.viewer.workflows.delete.useMutation({
    onSuccess: async () => {
      await utils.viewer.workflows.filteredList.invalidate();
      await additionalFunction();
      showToast(t("workflow_deleted_successfully"), "success");
      setIsOpenDialog(false);
    },
    onError: (err) => {
      if (err instanceof HttpError) {
        const message = `${err.statusCode}: ${err.message}`;
        showToast(message, "error");
        setIsOpenDialog(false);
      }
      if (err.data?.code === "UNAUTHORIZED") {
        const message = `${err.data.code}: You are not authorized to delete this workflow`;
        showToast(message, "error");
      }
    },
  });

  return (
    <Dialog
      open={isOpenDialog}
      onOpenChange={setIsOpenDialog}
      variant="danger"
      title={t("delete_workflow")}
      description={t("delete_workflow_description")}
      confirmBtnText={t("confirm_delete_workflow")}
      cancelBtnText={t("cancel")}
      loader={deleteMutation.isPending}
      size="md"
      onConfirm={() => {
        deleteMutation.mutate({ id: workflowId });
      }}
    />
  );
};
