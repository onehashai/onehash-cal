import Link from "next/link";
import { memo } from "react";

import { useIsEmbed } from "@calcom/embed-core/embed-iframe";
import { POWERED_BY_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";

interface PoweredByCalProps {
  logoOnly?: boolean;
  hideBranding?: boolean;
  bannerUrl?: string;
}

const PoweredByOH = memo<PoweredByCalProps>(({ logoOnly = false, hideBranding = false, bannerUrl }) => {
  const { t } = useLocale();
  const isEmbed = useIsEmbed();

  if (hideBranding && !bannerUrl) {
    return null;
  }

  const brandingClasses = ["text-center", "text-xs", "sm:text-right", isEmbed && "max-w-3xl"]
    .filter(Boolean)
    .join(" ");

  const logoImgClass = "relative -mt-px inline h-[10px] w-auto";

  const poweredByText = !logoOnly ? <>{t("powered_by")} </> : null;

  if (bannerUrl) {
    return (
      <div className={brandingClasses}>
        {poweredByText}
        <img
          className={logoImgClass}
          src={bannerUrl}
          alt="Brand Logo"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "/oh-logo-word.svg";
            target.alt = "OneHash Logo";
          }}
        />
      </div>
    );
  }

  return (
    <div className={brandingClasses}>
      <Link
        href={POWERED_BY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-subtle hover:text-emphasis transition-colors duration-200"
        aria-label="Powered by OneHash">
        {poweredByText}
        <img className={logoImgClass} src="/oh-logo-word.svg" alt="OneHash Logo" loading="lazy" />
      </Link>
    </div>
  );
});

PoweredByOH.displayName = "PoweredByOH";

export default PoweredByOH;
