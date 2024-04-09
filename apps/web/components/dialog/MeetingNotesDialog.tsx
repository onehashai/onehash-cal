import dynamic from "next/dynamic";
import type { Dispatch, SetStateAction } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button, Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@calcom/ui";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

interface IMeetingNotesDialog {
  isOpenDialog: boolean;
  setIsOpenDialog: Dispatch<SetStateAction<boolean>>;
  notes: string;
  setNotes: Dispatch<SetStateAction<string>>;
  handleMeetingNoteSave: () => void;
}

export const MeetingNotesDialog = (props: IMeetingNotesDialog) => {
  const { t } = useLocale();

  const { isOpenDialog, setIsOpenDialog, notes, setNotes, handleMeetingNoteSave } = props;

  return (
    <Dialog open={isOpenDialog} onOpenChange={setIsOpenDialog}>
      <DialogContent enableOverflow>
        <DialogHeader title={t("meeting_notes")} subtitle={t("meeting_notes_subtitle")} />
        <div>
          <ReactQuill theme="snow" value={notes} className="mb-14 h-40 w-full" onChange={setNotes} />
        </div>
        <DialogFooter>
          <Button onClick={handleMeetingNoteSave}>{t("save")}</Button>
          <DialogClose className="border" />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
