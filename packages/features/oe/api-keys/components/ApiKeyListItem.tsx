import dayjs from "@calcom/dayjs";
import { classNames } from "@calcom/lib";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import {
  Badge,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  showToast,
} from "@calcom/ui";

export type TApiKeys = RouterOutputs["viewer"]["apiKeys"]["list"][number];

const ApiKeyListItem = ({
  apiKey,
  lastItem,
  onEditClick,
}: {
  apiKey: TApiKeys;
  lastItem: boolean;
  onEditClick: () => void;
}) => {
  const { t } = useLocale();
  const trpcUtilities = trpc.useUtils();

  const hasExpired = apiKey?.expiresAt ? apiKey.expiresAt < new Date() : null;
  const permanentKey = apiKey?.expiresAt === null;

  const removeKeyMutation = trpc.viewer.apiKeys.delete.useMutation({
    async onSuccess() {
      await trpcUtilities.viewer.apiKeys.list.invalidate();
      showToast(t("api_key_deleted"), "success");
    },
    onError(error) {
      console.log(error);
      showToast(t("something_went_wrong"), "error");
    },
  });

  const getBadgeStatus = () => {
    if (!permanentKey && hasExpired) {
      return <Badge variant="red">{t("expired")}</Badge>;
    }
    if (!hasExpired) {
      return <Badge variant="green">{t("active")}</Badge>;
    }
    return null;
  };

  const getExpirationText = () => {
    if (permanentKey) {
      return <div className="flex flex-row space-x-3">{t("api_key_never_expires")}</div>;
    }
    const statusText = hasExpired ? t("expired") : t("expires");
    return `${statusText} ${dayjs(apiKey?.expiresAt?.toString()).fromNow()}`;
  };

  const handleKeyDeletion = () => {
    removeKeyMutation.mutate({
      id: apiKey.id,
    });
  };

  const containerClassNames = classNames(
    "flex w-full justify-between px-4 py-4 sm:px-6",
    lastItem ? "" : "border-subtle border-b"
  );

  const keyDisplayName = apiKey?.note ? apiKey.note : t("api_key_no_note");

  return (
    <div key={apiKey.id} className={containerClassNames}>
      <div>
        <div className="flex gap-1">
          <p className="text-sm font-semibold">{keyDisplayName}</p>
          {getBadgeStatus()}
        </div>
        <div className="mt-1 flex items-center space-x-3.5">
          <p className="text-default text-sm">{getExpirationText()}</p>
        </div>
      </div>
      <div>
        <Dropdown>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="icon" color="secondary" StartIcon="ellipsis" />
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            <DropdownMenuItem>
              <DropdownItem type="button" onClick={onEditClick} StartIcon="pencil">
                {t("edit") as string}
              </DropdownItem>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <DropdownItem
                type="button"
                color="destructive"
                disabled={removeKeyMutation.isPending}
                onClick={handleKeyDeletion}
                StartIcon="trash">
                {t("delete") as string}
              </DropdownItem>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </Dropdown>
      </div>
    </div>
  );
};

export default ApiKeyListItem;
