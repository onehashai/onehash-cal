"use client";

import AllProducts from "@calcom/features/shell/AllProducts";
import Shell, { MobileNavigationMoreItems } from "@calcom/features/shell/Shell";
import { useLocale } from "@calcom/lib/hooks/useLocale";

import PageWrapper from "@components/PageWrapper";

export default function MorePage() {
  const { t } = useLocale();
  return (
    <Shell hideHeadingOnMobile>
      <div className="max-w-screen-lg">
        <MobileNavigationMoreItems />
        <AllProducts />
        <p className="text-subtle mt-6 text-xs leading-tight md:hidden">{t("more_page_footer")}</p>
      </div>
    </Shell>
  );
}
MorePage.PageWrapper = PageWrapper;
