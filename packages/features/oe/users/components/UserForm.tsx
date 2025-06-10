// eslint-disable-next-line no-restricted-imports
import { noop } from "lodash";
import { Controller, useForm } from "react-hook-form";

import { getUserAvatarUrl } from "@calcom/lib/getAvatarUrl";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { defaultLocaleOption, localeOptions } from "@calcom/lib/i18n";
import { nameOfDay } from "@calcom/lib/weekday";
import {
  Avatar,
  Button,
  EmailField,
  Form,
  ImageUploader,
  Label,
  Select,
  TextField,
  TimezoneSelect,
} from "@calcom/ui";

import type { UserManagementRouterOutputs } from "../server/trpc-router";

type UserEntity = UserManagementRouterOutputs["get"]["user"];

interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
}

interface UserFormSettings {
  locale: SelectOption;
  timeFormat: SelectOption<number>;
  timeZone: string;
  weekStart: SelectOption;
  role: SelectOption;
  identityProvider: SelectOption;
}

type UserFormData = Pick<UserEntity, "avatarUrl" | "name" | "username" | "email" | "bio"> & UserFormSettings;

interface UserFormProps {
  defaultValues?: Pick<UserEntity, keyof UserFormData>;
  localeProp?: string;
  onSubmit: (data: UserFormData) => void;
  submitLabel?: string;
}

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const USER_ROLES = [
  { value: "USER", label: "user" },
  { value: "ADMIN", label: "admin" },
] as const;

const IDENTITY_PROVIDERS = [
  { value: "CAL", label: "CAL" },
  { value: "GOOGLE", label: "GOOGLE" },
  { value: "SAML", label: "SAML" },
] as const;

const TIME_FORMATS = [
  { value: 12, label: "12_hour" },
  { value: 24, label: "24_hour" },
] as const;

export const UserForm = ({
  defaultValues,
  localeProp = "en",
  onSubmit = noop,
  submitLabel = "save",
}: UserFormProps) => {
  const { t } = useLocale();

  const hourFormatChoices = TIME_FORMATS.map(({ value, label }) => ({
    value,
    label: t(label),
  }));

  const dayStartChoices = WEEK_DAYS.map((day, index) => ({
    value: day,
    label: nameOfDay(localeProp, index),
  }));

  const roleChoices = USER_ROLES.map(({ value, label }) => ({
    value,
    label: t(label),
  }));

  const providerChoices = IDENTITY_PROVIDERS.map(({ value, label }) => ({
    value,
    label,
  }));

  const currentLocale = defaultValues?.locale || defaultLocaleOption.value;

  const formMethods = useForm<UserFormData>({
    defaultValues: {
      avatarUrl: defaultValues?.avatarUrl,
      name: defaultValues?.name,
      username: defaultValues?.username,
      email: defaultValues?.email,
      bio: defaultValues?.bio,
      locale: {
        value: currentLocale,
        label: new Intl.DisplayNames(currentLocale, { type: "language" }).of(currentLocale) || "",
      },
      timeFormat: {
        value: defaultValues?.timeFormat || 12,
        label: hourFormatChoices.find((choice) => choice.value === defaultValues?.timeFormat)?.label || "12",
      },
      timeZone: defaultValues?.timeZone || "",
      weekStart: {
        value: defaultValues?.weekStart || dayStartChoices[0].value,
        label:
          dayStartChoices.find((choice) => choice.value === defaultValues?.weekStart)?.label ||
          dayStartChoices[0].label,
      },
      role: {
        value: defaultValues?.role || roleChoices[0].value,
        label:
          roleChoices.find((choice) => choice.value === defaultValues?.role)?.label || roleChoices[0].label,
      },
      identityProvider: {
        value: defaultValues?.identityProvider || providerChoices[0].value,
        label:
          providerChoices.find((choice) => choice.value === defaultValues?.identityProvider)?.label ||
          providerChoices[0].label,
      },
    },
  });

  const handleImageChange = (newImageUrl: string) => {
    formMethods.setValue("avatarUrl", newImageUrl);
  };

  const handleTimezoneChange = (selectedTimezone: { value: string } | null) => {
    if (selectedTimezone) {
      formMethods.setValue("timeZone", selectedTimezone.value);
    }
  };

  const handleTimeFormatChange = (selectedFormat: SelectOption<number> | null) => {
    if (selectedFormat) {
      formMethods.setValue("timeFormat", selectedFormat);
    }
  };

  const handleWeekStartChange = (selectedWeekStart: SelectOption | null) => {
    if (selectedWeekStart) {
      formMethods.setValue("weekStart", selectedWeekStart);
    }
  };

  const currentName = formMethods.getValues("name") || "";
  const currentAvatar = formMethods.watch("avatarUrl");

  return (
    <Form form={formMethods} className="space-y-4" handleSubmit={onSubmit}>
      <div className="flex items-center">
        <Avatar
          alt={currentName}
          imageSrc={getUserAvatarUrl({
            avatarUrl: currentAvatar,
          })}
          size="lg"
        />
        <div className="ml-4">
          <ImageUploader
            target="avatar"
            id="avatar-upload"
            buttonMsg="Change avatar"
            handleAvatarChange={handleImageChange}
            imageSrc={getUserAvatarUrl({
              avatarUrl: currentAvatar,
            })}
          />
        </div>
      </div>

      <Controller
        name="role"
        control={formMethods.control}
        render={({ field: { onChange, value } }) => (
          <div>
            <Label className="text-default font-medium" htmlFor="role">
              {t("role")}
            </Label>
            <Select<{ label: string; value: string }>
              value={value}
              options={roleChoices}
              onChange={onChange}
            />
          </div>
        )}
      />

      <Controller
        name="identityProvider"
        control={formMethods.control}
        render={({ field: { value, onChange } }) => (
          <div>
            <Label className="text-default font-medium" htmlFor="identityProvider">
              {t("identity_provider")}
            </Label>
            <Select<SelectOption> value={value} options={providerChoices} onChange={onChange} />
          </div>
        )}
      />

      <TextField label="Name" placeholder="example" required {...formMethods.register("name")} />

      <TextField label="Username" placeholder="example" required {...formMethods.register("username")} />

      <EmailField label="Email" placeholder="user@example.com" required {...formMethods.register("email")} />

      <TextField label="About" {...formMethods.register("bio")} />

      <Controller
        name="locale"
        control={formMethods.control}
        render={({ field: { value, onChange } }) => (
          <>
            <Label className="text-default">{t("language")}</Label>
            <Select<SelectOption>
              className="capitalize"
              options={localeOptions}
              value={value}
              onChange={onChange}
            />
          </>
        )}
      />

      <Controller
        name="timeZone"
        control={formMethods.control}
        render={({ field: { value } }) => (
          <>
            <Label className="text-default mt-8">{t("timezone")}</Label>
            <TimezoneSelect id="timezone" value={value} onChange={handleTimezoneChange} />
          </>
        )}
      />

      <Controller
        name="timeFormat"
        control={formMethods.control}
        render={({ field: { value } }) => (
          <>
            <Label className="text-default mt-8">{t("time_format")}</Label>
            <Select<SelectOption<number>>
              value={value}
              options={hourFormatChoices}
              onChange={handleTimeFormatChange}
            />
          </>
        )}
      />

      <Controller
        name="weekStart"
        control={formMethods.control}
        render={({ field: { value } }) => (
          <>
            <Label className="text-default mt-8">{t("start_of_week")}</Label>
            <Select<SelectOption> value={value} options={dayStartChoices} onChange={handleWeekStartChange} />
          </>
        )}
      />

      <br />
      <Button type="submit" color="primary">
        {t(submitLabel)}
      </Button>
    </Form>
  );
};
