// import { LineChart, HeartHandshakeIcon } from "lucide-react";
import { useState } from "react";

import classNames from "@calcom/lib/classNames";
import { ONEHASH_CHAT_URL, ONEHASH_CRM_URL, ONEHASH_ERP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import {
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@calcom/ui";
import { ChevronRight, MessageCircle, LineChart, HeartHandshake, Boxes } from "@calcom/ui/components/icon";

const AllProducts = () => {
  const [expanded, setIsExpanded] = useState(false);
  const { t } = useLocale();

  const toggleDropdown = () => {
    setIsExpanded(!expanded);
  };

  return (
    <div className="relative">
      <hr />
      <Dropdown open={expanded}>
        <DropdownMenuTrigger asChild onClick={toggleDropdown}>
          <div
            className={classNames(
              "todesktop:py-[7px] text-default group flex items-center rounded-md p-5 text-base font-medium transition  md:px-2 md:py-1.5 md:text-sm",
              `[&[aria-current='page']]:!bg-transparent`,

              "[&[aria-current='page']]:text-emphasis mt-0.5 text-sm",
              "hover:bg-subtle todesktop:[&[aria-current='page']]:bg-emphasis todesktop:hover:bg-transparent hover:text-emphasis",
              "flex items-center justify-between",
              "border-subtle rounded-md border border-t-0 font-semibold md:border-none md:font-normal"
            )}>
            <div className="flex gap-3 md:hidden md:gap-2 lg:flex ">
              <Boxes className="h-4 w-4" />
              <span>{t("all_products")}</span>
            </div>

            <ChevronRight
              strokeWidth="2"
              className={classNames(
                "text-muted h-4 w-4",
                expanded ? "rotate-90 transform" : " rotate-0 transform"
              )}
            />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            align="start"
            onInteractOutside={() => {
              setIsExpanded(false);
            }}
            className="group overflow-hidden rounded-md">
            <>
              <DropdownMenuItem>
                <DropdownItem
                  StartIcon={() => <MessageCircle className="text-default h-4 w-4" />}
                  target="_blank"
                  rel="noreferrer"
                  href={ONEHASH_CHAT_URL}
                  disabled={ONEHASH_CHAT_URL === undefined}>
                  {t("onehash_chat")}
                  {ONEHASH_CHAT_URL === undefined && (
                    <span className="ml-2 text-red-500"> {t("coming_soon")}</span>
                  )}
                </DropdownItem>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <DropdownItem
                  StartIcon={() => <HeartHandshake className="text-default h-4 w-4" />}
                  target="_blank"
                  rel="noreferrer"
                  href={ONEHASH_CRM_URL}
                  disabled={ONEHASH_CRM_URL === undefined}>
                  {t("onehash_crm")}
                  {ONEHASH_CRM_URL === undefined && (
                    <span className="ml-2 text-red-500"> {t("coming_soon")}</span>
                  )}
                </DropdownItem>
              </DropdownMenuItem>

              <DropdownMenuItem>
                <DropdownItem
                  StartIcon={() => <LineChart className="text-default h-4 w-4" />}
                  target="_blank"
                  rel="noreferrer"
                  href={ONEHASH_ERP_URL}
                  disabled={ONEHASH_ERP_URL === undefined}>
                  {t("onehash_erp")}
                  {ONEHASH_ERP_URL === undefined && (
                    <span className="ml-2 text-red-500"> {t("coming_soon")}</span>
                  )}
                </DropdownItem>
              </DropdownMenuItem>
            </>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </Dropdown>
    </div>
  );
};

export default AllProducts;
