import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import dayjs from "@calcom/dayjs";
import type { TApiKeys } from "@calcom/features/oe/api-keys/components/ApiKeyListItem";
import LicenseRequired from "@calcom/features/oe/common/components/LicenseRequired";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button, DialogFooter, Form, SelectField, showToast, Switch, TextField, Tooltip } from "@calcom/ui";

export default function ApiKeyDialogForm({
  defaultValues,
  handleClose,
}: {
  defaultValues?: Omit<TApiKeys, "userId" | "createdAt" | "lastUsedAt"> & { neverExpires?: boolean };
  handleClose: () => void;
}) {
  const locale = useLocale();
  const trpcUtils = trpc.useUtils();

  const editKeyMutation = trpc.viewer.apiKeys.edit.useMutation({
    onSuccess() {
      trpcUtils.viewer.apiKeys.list.invalidate();
      showToast(locale.t("api_key_updated"), "success");
      handleClose();
    },
    onError() {
      showToast(locale.t("api_key_update_failed"), "error");
    },
  });

  interface SelectOption {
    value: Date | null | undefined;
    label: string;
  }

  const [generatedKey, setGeneratedKey] = useState("");
  const [selectedExpiry, setSelectedExpiry] = useState<Date | null | undefined>(
    () => defaultValues?.expiresAt || dayjs().add(30, "day").toDate()
  );
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [keyConfiguration, setKeyConfiguration] = useState({
    expiresAt: null as Date | null,
    note: "" as string | null,
    neverExpires: false,
  });

  const formInstance = useForm({
    defaultValues: {
      note: defaultValues?.note || "",
      neverExpires: defaultValues?.neverExpires || false,
      expiresAt: defaultValues?.expiresAt || dayjs().add(30, "day").toDate(),
    },
  });

  const neverExpiresWatch = formInstance.watch("neverExpires");

  const durationChoices: SelectOption[] = [
    {
      label: locale.t("seven_days"),
      value: dayjs().add(7, "day").toDate(),
    },
    {
      label: locale.t("thirty_days"),
      value: dayjs().add(30, "day").toDate(),
    },
    {
      label: locale.t("three_months"),
      value: dayjs().add(3, "month").toDate(),
    },
    {
      label: locale.t("one_year"),
      value: dayjs().add(1, "year").toDate(),
    },
  ];

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedKey);
    showToast(locale.t("api_key_copied"), "success");
  };

  const processFormSubmission = async (formData: any) => {
    if (defaultValues) {
      console.log("Name changed");
      await editKeyMutation.mutate({ id: defaultValues.id, note: formData.note });
    } else {
      const createdApiKey = await trpcUtils.client.viewer.apiKeys.create.mutate(formData);
      setGeneratedKey(createdApiKey);
      setKeyConfiguration({ ...formData });
      await trpcUtils.viewer.apiKeys.list.invalidate();
      setShowSuccessModal(true);
    }
  };

  const handleExpirySelection = (selectedOption: SelectOption | null) => {
    if (!selectedOption || !selectedOption.value) return;
    formInstance.setValue("expiresAt", selectedOption.value);
    setSelectedExpiry(selectedOption.value);
  };

  const renderSuccessView = () => (
    <>
      <div className="mb-6">
        <h2 className="font-semi-bold font-cal text-emphasis mb-2 text-xl tracking-wide">
          {locale.t("success_api_key_created")}
        </h2>
        <div className="text-emphasis text-sm">
          <span className="font-semibold">{locale.t("success_api_key_created_bold_tagline")}</span>{" "}
          {locale.t("you_will_only_view_it_once")}
        </div>
      </div>
      <div>
        <div className="flex">
          <code className="bg-subtle text-default w-full truncate rounded-md rounded-r-none py-[6px] pl-2 pr-2 align-middle font-mono">
            {" "}
            {generatedKey}
          </code>
          <Tooltip side="top" content={locale.t("copy_to_clipboard")}>
            <Button
              onClick={copyToClipboard}
              type="button"
              className="rounded-l-none text-base"
              StartIcon="clipboard">
              {locale.t("copy")}
            </Button>
          </Tooltip>
        </div>
        <span className="text-muted text-sm">
          {keyConfiguration.neverExpires
            ? locale.t("never_expires")
            : `${locale.t("expires")} ${keyConfiguration?.expiresAt?.toLocaleDateString()}`}
        </span>
      </div>
      <DialogFooter showDivider className="relative">
        <Button type="button" color="secondary" onClick={handleClose} tabIndex={-1}>
          {locale.t("done")}
        </Button>
      </DialogFooter>
    </>
  );

  const renderFormView = () => (
    <Form form={formInstance} handleSubmit={processFormSubmission} className="space-y-4">
      <div className="mb-4 mt-1">
        <h2 className="font-semi-bold font-cal text-emphasis text-xl tracking-wide">
          {defaultValues ? locale.t("edit_api_key") : locale.t("create_api_key")}
        </h2>
        <p className="text-subtle mb-5 mt-1 text-sm">{locale.t("api_key_modal_subtitle")}</p>
      </div>
      <div>
        <Controller
          name="note"
          control={formInstance.control}
          render={({ field: { onChange, value } }) => (
            <TextField
              name="note"
              label={locale.t("personal_note")}
              placeholder={locale.t("personal_note_placeholder")}
              value={value}
              onChange={(event) => {
                formInstance.setValue("note", event?.target.value);
              }}
              type="text"
            />
          )}
        />
      </div>
      {!defaultValues && (
        <div className="flex flex-col">
          <div className="flex justify-between py-2">
            <span className="text-default block text-sm font-medium">{locale.t("expire_date")}</span>
            <Controller
              name="neverExpires"
              control={formInstance.control}
              render={({ field: { onChange, value } }) => (
                <Switch
                  label={locale.t("never_expires")}
                  onCheckedChange={onChange}
                  checked={value}
                  disabled={!!defaultValues}
                />
              )}
            />
          </div>
          <Controller
            name="expiresAt"
            render={({ field: { onChange, value } }) => {
              const standardChoice = durationChoices[1];

              return (
                <SelectField
                  styles={{
                    singleValue: (baseStyles) => ({
                      ...baseStyles,
                      fontSize: "14px",
                    }),
                    option: (baseStyles) => ({
                      ...baseStyles,
                      fontSize: "14px",
                    }),
                  }}
                  isDisabled={neverExpiresWatch || !!defaultValues}
                  containerClassName="data-testid-field-type"
                  options={durationChoices}
                  onChange={handleExpirySelection}
                  defaultValue={standardChoice}
                />
              );
            }}
          />
          {!neverExpiresWatch && (
            <span className="text-subtle mt-2 text-xs">
              {locale.t("api_key_expires_on")}
              <span className="font-bold"> {dayjs(selectedExpiry).format("DD-MM-YYYY")}</span>
            </span>
          )}
        </div>
      )}

      <DialogFooter showDivider className="relative">
        <Button type="button" color="secondary" onClick={handleClose} tabIndex={-1}>
          {locale.t("cancel")}
        </Button>
        <Button type="submit" loading={formInstance.formState.isSubmitting}>
          {keyConfiguration ? locale.t("save") : locale.t("create")}
        </Button>
      </DialogFooter>
    </Form>
  );

  return <LicenseRequired>{showSuccessModal ? renderSuccessView() : renderFormView()}</LicenseRequired>;
}
