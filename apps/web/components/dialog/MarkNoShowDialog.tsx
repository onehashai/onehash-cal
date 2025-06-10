import type { Dispatch, SetStateAction } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import {
  Button,
  CheckboxField,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@calcom/ui";

type AttendeeProps = {
  name?: string;
  email: string;
  phoneNumber: string | null;
  id: number;
  noShow: boolean;
};

interface IMarkNoShowDialog {
  isOpenDialog: boolean;
  setIsOpenDialog: Dispatch<SetStateAction<boolean>>;
  attendees: AttendeeProps[];
  onSubmitNoShow: (data: { attendees: AttendeeProps[] }) => void;
}

export const MarkNoShowDialog = (props: IMarkNoShowDialog) => {
  const { t } = useLocale();

  const { isOpenDialog, setIsOpenDialog, attendees, onSubmitNoShow } = props;

  const { control, handleSubmit } = useForm<{
    attendees: AttendeeProps[];
  }>({
    defaultValues: {
      attendees,
    },
    mode: "onBlur",
  });
  const { fields } = useFieldArray({
    control,
    name: "attendees",
  });

  return (
    <Dialog open={isOpenDialog} onOpenChange={setIsOpenDialog}>
      <DialogContent enableOverflow>
        <DialogHeader title={t("mark_no_show")} subtitle={t("mark_no_show_desc")} />
        <form>
          {fields.map((field, index) => (
            <Controller
              key={field.id}
              name={`attendees.${index}.noShow`}
              control={control}
              render={({ field: { onChange, value } }) => (
                <span className={value ? "line-through" : ""}>
                  <CheckboxField
                    checked={value || false}
                    description={field.name?.trim() || field.email}
                    onChange={() => onChange(!value)}
                  />
                </span>
              )}
            />
          ))}
        </form>
        <DialogFooter>
          <Button onClick={handleSubmit(onSubmitNoShow)}>{t("confirm")}</Button>
          <DialogClose className="border" />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
