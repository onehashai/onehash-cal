import Link from "next/link";

import { useIsEmbed } from "@calcom/embed-core/embed-iframe";
import { POWERED_BY_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";

const PoweredByCal = ({
  logoOnly,
  hideBranding,
  bannerUrl,
}: {
  logoOnly?: boolean;
  hideBranding?: boolean;
  bannerUrl?: string;
}) => {
  const { t } = useLocale();
  const isEmbed = useIsEmbed();

  const brandingClasses = `text-center text-xs sm:text-right${isEmbed ? " max-w-3xl" : ""}`;
  const logoImgClass = "relative -mt-px inline h-[10px] w-auto";

  return bannerUrl ? (
    <div className={brandingClasses}>
      {!logoOnly && <>{t("powered_by")} </>}
      <img className={logoImgClass} src={bannerUrl} alt="Brand Logo" />
    </div>
  ) : hideBranding ? null : (
    <div className={brandingClasses}>
      <Link href={POWERED_BY_URL} target="_blank" className="text-subtle">
        {!logoOnly && <>{t("powered_by")} </>}
        <img className={logoImgClass} src="/cal-logo-word.svg" alt="Cal Logo" />
      </Link>
    </div>
  );
};

export default PoweredByCal;
