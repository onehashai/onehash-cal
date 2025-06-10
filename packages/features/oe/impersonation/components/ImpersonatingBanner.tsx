import { signIn, type SessionContextValue } from "next-auth/react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { TopBanner } from "@calcom/ui";

export type ImpersonatingBannerProps = { data: SessionContextValue["data"] };

const ImpersonatingBanner = ({ data }: ImpersonatingBannerProps) => {
  const { t } = useLocale();

  const activeUser = data?.user;
  const masqueradingSource = activeUser?.impersonatedBy;

  if (!masqueradingSource) {
    return null;
  }

  const originalUserId = masqueradingSource.id;
  const shouldAllowRevert = true;

  const handleRevertAction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    signIn("impersonation-auth", { returnToId: originalUserId });
  };

  const warningMessage = t("impersonating_user_warning", { user: activeUser.username });
  const stopInstructions = t("impersonating_stop_instructions");

  const revertElement = shouldAllowRevert ? (
    <form onSubmit={handleRevertAction}>
      <button className="text-emphasis hover:underline" data-testid="stop-impersonating-button" type="submit">
        {stopInstructions}
      </button>
    </form>
  ) : (
    <a className="border-b border-b-black" href="/auth/logout">
      {stopInstructions}
    </a>
  );

  return <TopBanner text={warningMessage} variant="warning" actions={revertElement} />;
};

export default ImpersonatingBanner;
