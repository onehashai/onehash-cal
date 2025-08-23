import { Button } from "@onehash/oe-features/ui";
import { Plus } from "lucide-react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Icon } from "@calcom/ui";

interface Props {
  createWorkflowFn: () => void;
  loading?: boolean;
}

const NoWorkflowsComponent = ({ createWorkflowFn, loading }: Props) => {
  const { t } = useLocale();
  return (
    <div className="bg-default min-h-screen">
      {/* Header Section */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-emphasis mb-2 text-2xl font-semibold">{t("workflows_title")}</h1>
          <p className="text-default mb-8">{t("workflows_subtitle")}</p>
          {/* //OE_FEATURES: will enable after developing teams
          <div className="w-[200px]">
            <TeamsSelectFilter />
          </div> */}
        </div>
      </div>

      {/* Empty State */}
      <div className="flex flex-col items-center justify-center px-6 py-20">
        <div className="bg-emphasis mb-8 flex h-16 w-16 items-center justify-center rounded-full">
          <Icon name="zap" className="text-default h-8 w-8" />
        </div>

        <h2 className="text-emphasis mb-4 text-xl font-semibold">{t("create_first_workflow")}</h2>

        <p className="text-default mb-8 max-w-md text-center leading-relaxed">{t("workflows_description")}</p>

        <Button
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => {
            createWorkflowFn();
          }}
          loading={loading}>
          <Plus className="mr-2 h-4 w-4" />
          {t("create_workflow")}
        </Button>
      </div>
    </div>
  );
};

export default NoWorkflowsComponent;
