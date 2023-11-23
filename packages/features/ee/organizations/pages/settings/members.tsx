import { getLayout } from "@calcom/features/settings/layouts/SettingsLayout";
import { UserListTable } from "@calcom/features/users/components/UserTable/UserListTable";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Meta } from "@calcom/ui";

const MembersView = () => {
  const { t } = useLocale();

  return (
    <>
      <Meta title={t("organization_members")} description={t("organization_description")} />
      <div>
        <UserListTable />
      </div>
    </>
  );
};
MembersView.getLayout = getLayout;

export default MembersView;
