// eslint-disable-next-line no-restricted-imports
import { startCase } from "lodash";
import { memo } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Icon, FilterSelect } from "@calcom/ui";

import { useFilterContext } from "../context/provider";

export const WorkflowMethods = {
  EMAIL: "EMAIL",
  SMS: "SMS",
  WHATSAPP: "WHATSAPP",
} as const;

type WorkflowMethodType = keyof typeof WorkflowMethods;

const mapTypeToOption = (type: WorkflowMethodType) => ({
  value: type,
  label: startCase(type.toLowerCase()),
});

export const WorkflowTypeFilter = memo(() => {
  const { t } = useLocale();
  const { filter, setConfigFilters } = useFilterContext();
  const { selectedType } = filter;

  const filterOptions = Object.keys(WorkflowMethods).map((key) => mapTypeToOption(key as WorkflowMethodType));

  return (
    <FilterSelect
      title={t("type")}
      options={filterOptions}
      selectedValue={selectedType}
      onChange={(value) => setConfigFilters({ selectedType: (value as WorkflowMethodType) || undefined })}
      buttonIcon={<Icon name="filter" className="mr-2 h-4 w-4" />}
      emptyText={t("no_options_available")}
    />
  );
});

WorkflowTypeFilter.displayName = "WorkflowTypeFilter";
