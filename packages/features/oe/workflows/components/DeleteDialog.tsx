import type { Dispatch, SetStateAction } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { HttpError } from "@calcom/lib/http-error";
import { trpc } from "@calcom/trpc/react";
import { ConfirmationDialogContent, Dialog, showToast } from "@calcom/ui";

interface IDeleteDialog {
  isOpenDialog: boolean;
  setIsOpenDialog: Dispatch<SetStateAction<boolean>>;
  workflowId: number;
  additionalFunction: () => Promise<boolean | void>;
}

export const DeleteDialog = (props: IDeleteDialog) => {
  const localization = useLocale();
  const translate = localization.t;
  const dialogVisibility = props.isOpenDialog;
  const dialogVisibilitySetter = props.setIsOpenDialog;
  const targetWorkflowId = props.workflowId;
  const postDeletionCallback = props.additionalFunction;

  const trpcUtils = trpc.useUtils();

  const workflowDeletionMutation = trpc.viewer.workflows.delete.useMutation({
    onSuccess: async () => {
      const invalidateCache = async () => {
        await trpcUtils.viewer.workflows.filteredList.invalidate();
      };

      await invalidateCache();
      postDeletionCallback();

      const successMessage = translate("workflow_deleted_successfully");
      showToast(successMessage, "success");
      dialogVisibilitySetter(false);
    },
    onError: (error) => {
      const handleHttpError = (httpErr: HttpError) => {
        const errorMessage = `${httpErr.statusCode}: ${httpErr.message}`;
        showToast(errorMessage, "error");
        dialogVisibilitySetter(false);
      };

      const handleUnauthorizedError = () => {
        if (error.data?.code === "UNAUTHORIZED") {
          const unauthorizedMessage = `${error.data.code}: You are not authorized to delete this workflow`;
          showToast(unauthorizedMessage, "error");
        }
      };

      if (error instanceof HttpError) {
        handleHttpError(error);
      }

      handleUnauthorizedError();
    },
  });

  const confirmationHandler = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.preventDefault();
    const mutationPayload = { id: targetWorkflowId };
    workflowDeletionMutation.mutate(mutationPayload);
  };

  const isProcessing = workflowDeletionMutation.isPending;

  const dialogTitle = translate("delete_workflow");
  const confirmButtonLabel = translate("confirm_delete_workflow");
  const loadingLabel = translate("confirm_delete_workflow");
  const dialogDescription = translate("delete_workflow_description");

  return (
    <Dialog open={dialogVisibility} onOpenChange={dialogVisibilitySetter}>
      <ConfirmationDialogContent
        isPending={isProcessing}
        variety="danger"
        title={dialogTitle}
        confirmBtnText={confirmButtonLabel}
        loadingText={loadingLabel}
        onConfirm={confirmationHandler}>
        {dialogDescription}
      </ConfirmationDialogContent>
    </Dialog>
  );
};
