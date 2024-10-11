import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { Dialog, DialogContent } from "@calcom/ui";

interface IGroupMeetingDialog {
  isOpenDialog: boolean;
  setIsOpenDialog: Dispatch<SetStateAction<boolean>>;
  link: string;
}

export const GroupMeetingDialog = (props: IGroupMeetingDialog) => {
  const { isOpenDialog, setIsOpenDialog, link } = props;
  const [loading, setLoading] = useState(true);

  const handleLoad = () => {
    setLoading(false);
  };

  return (
    <Dialog open={isOpenDialog} onOpenChange={setIsOpenDialog}>
      <DialogContent size="xl">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
            <div className="loader" />
          </div>
        )}
        <iframe src={link} className="h-[850px] border-none" title="Embedded Content" onLoad={handleLoad} />
      </DialogContent>
    </Dialog>
  );
};
