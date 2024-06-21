import type { Dispatch, SetStateAction } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { $Enums } from "@calcom/prisma/client";
import { trpc } from "@calcom/trpc/react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  showToast,
} from "@calcom/ui";

interface IMarkNoShowDialog {
  isOpenDialog: boolean;
  setIsOpenDialog: Dispatch<SetStateAction<boolean>>;
  workflows: {
    id: number;
    referenceId: string | null;
    method: $Enums.WorkflowMethods;
  }[];
}

export const MarkNoShowDialog = (props: IMarkNoShowDialog) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const { isOpenDialog, setIsOpenDialog, workflows } = props;
  const handleMarkNoShow = () => {
    cancelWorkflowMutation.mutate({
      workflows: workflows.map((workflow) => ({
        id: workflow.id,
        referenceId: workflow.referenceId,
        method: workflow.method.valueOf() as $Enums.WorkflowMethods,
      })),
    });
  };
  const cancelWorkflowMutation = trpc.viewer.bookings.cancelWorkflow.useMutation({
    onSuccess: () => {
      showToast(t("marked_as_no_show"), "success");
      setIsOpenDialog(false);
      utils.viewer.bookings.invalidate();
    },
  });

  return (
    <Dialog open={isOpenDialog} onOpenChange={setIsOpenDialog}>
      <DialogContent enableOverflow>
        <DialogHeader title={t("mark_no_show")} subtitle={t("mark_no_show_subtitle")} />
        <p className="font-semibold">{t("mark_no_show_desc")}</p>
        <DialogFooter>
          <Button onClick={handleMarkNoShow}>{t("proceed")}</Button>
          <DialogClose className="border" />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
