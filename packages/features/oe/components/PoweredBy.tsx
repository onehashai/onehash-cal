import Link from "next/link";

import { useIsEmbed } from "@calcom/embed-core/embed-iframe";
import { POWERED_BY_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";

const PoweredByCal = ({ logoOnly }: { logoOnly?: boolean }) => {
  const { t } = useLocale();
  const isEmbed = useIsEmbed();

  return (
    <div className={` text-center text-xs sm:text-right${isEmbed ? " max-w-3xl" : ""}`}>
      <Link href={POWERED_BY_URL} target="_blank" className="text-subtle">
        {!logoOnly && <>{t("powered_by")} </>}
        <img className="relative -mt-px inline h-[10px] w-auto " src="/cal-logo-word.svg" alt="Cal Logo" />
      </Link>
    </div>
  );
};

export default PoweredByCal;
