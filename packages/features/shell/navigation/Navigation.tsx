import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { useEffect, useState } from "react";
import AllProducts from "shell/AllProducts";

import { useIsEmbed } from "@calcom/embed-core/embed-iframe";
import UnconfirmedBookingBadge from "@calcom/features/bookings/UnconfirmedBookingBadge";
import { KBarTrigger } from "@calcom/features/kbar/Kbar";
import {
  useOrgBranding,
  type OrganizationBranding,
} from "@calcom/features/oe/organizations/context/provider";
import { classNames, isPrismaObjOrUndefined } from "@calcom/lib";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import { showToast, Tooltip, Icon, Button } from "@calcom/ui";

import { TeamInviteBadge } from "../TeamInviteBadge";
import type { NavigationItemType } from "./NavigationItem";
import { NavigationItem, MobileNavigationItem, MobileNavigationMoreItem } from "./NavigationItem";

export const MORE_SEPARATOR_NAME = "more";

const getNavigationItems = (orgBranding: OrganizationBranding): NavigationItemType[] => [
  {
    name: "event_types_page_title",
    href: "/event-types",
    icon: "link",
  },
  {
    name: "bookings",
    href: "/bookings/upcoming",
    icon: "calendar",
    badge: <UnconfirmedBookingBadge />,
    isCurrent: ({ pathname }) => pathname?.startsWith("/bookings") ?? false,
  },
  {
    name: "availability",
    href: "/availability",
    icon: "clock",
  },
  ...(orgBranding
    ? [
        {
          name: "members",
          href: `/settings/organizations/${orgBranding.slug}/members`,
          icon: "building",
          moreOnMobile: true,
        } satisfies NavigationItemType,
      ]
    : []),
  {
    name: "teams",
    href: "/teams",
    icon: "users",
    onlyDesktop: true,
    badge: <TeamInviteBadge />,
  },
  {
    name: "apps",
    href: "/apps",
    icon: "grid-3x3",
    isCurrent: ({ pathname: path, item }) => {
      // During Server rendering path is /v2/apps but on client it becomes /apps(weird..)
      return (path?.startsWith(item.href) ?? false) && !(path?.includes("routing-forms/") ?? false);
    },
    child: [
      {
        name: "app_store",
        href: "/apps",
        isCurrent: ({ pathname: path, item }) => {
          // During Server rendering path is /v2/apps but on client it becomes /apps(weird..)
          return (
            (path?.startsWith(item.href) ?? false) &&
            !(path?.includes("routing-forms/") ?? false) &&
            !(path?.includes("/installed") ?? false)
          );
        },
      },
      {
        name: "installed_apps",
        href: "/apps/installed/calendar",
        isCurrent: ({ pathname: path }) =>
          (path?.startsWith("/apps/installed/") ?? false) ||
          (path?.startsWith("/v2/apps/installed/") ?? false),
      },
    ],
  },
  {
    name: MORE_SEPARATOR_NAME,
    href: "/more",
    icon: "ellipsis",
  },
  {
    name: "routing_forms",
    href: "/apps/routing-forms/forms",
    icon: "file-text",
    isCurrent: ({ pathname }) => pathname?.startsWith("/apps/routing-forms/") ?? false,
    moreOnMobile: true,
  },
  {
    name: "workflows",
    href: "/workflows",
    icon: "zap",
    moreOnMobile: true,
  },
  {
    name: "insights",
    href: "/insights",
    icon: "chart-bar",
    isCurrent: ({ pathname: path, item }) => path?.startsWith(item.href) ?? false,
    moreOnMobile: true,
    child: [
      {
        name: "bookings",
        href: "/insights",
        isCurrent: ({ pathname: path }) => path == "/insights" ?? false,
      },
      {
        name: "routing",
        href: "/insights/routing",
        isCurrent: ({ pathname: path }) => path?.startsWith("/insights/routing") ?? false,
      },
    ],
  },
];

const platformNavigationItems: NavigationItemType[] = [
  {
    name: "Dashboard",
    href: "/settings/platform/",
    icon: "layout-dashboard",
  },
  {
    name: "Documentation",
    href: "https://chat.onehash.ai/hc/onehash-help-center/en/categories/onehash-cal",
    icon: "chart-bar",
    target: "_blank",
  },
  {
    name: "API reference",
    href: "https://api.cal.id/docs#/",
    icon: "terminal",
    target: "_blank",
  },
  // {
  //   name: "Atoms",
  //   href: "https://docs.cal.com/docs/platform#atoms",
  //   icon: "atom",
  //   target: "_blank",
  // },
  // {
  //   name: MORE_SEPARATOR_NAME,
  //   href: "https://docs.cal.com/docs/platform/faq",
  //   icon: "ellipsis",
  //   target: "_blank",
  // },
  // {
  //   name: "Billing",
  //   href: "/settings/platform/billing",
  //   icon: "credit-card",
  //   moreOnMobile: true,
  // },
  // {
  //   name: "Members",
  //   href: "/settings/platform/members",
  //   icon: "users",
  //   moreOnMobile: true,
  // },
];

const useNavigationItems = (isPlatformNavigation = false) => {
  const orgBranding = useOrgBranding();
  return useMemo(() => {
    const items = !isPlatformNavigation ? getNavigationItems(orgBranding) : platformNavigationItems;

    const desktopNavigationItems = items.filter((item) => item.name !== MORE_SEPARATOR_NAME);
    const mobileNavigationBottomItems = items.filter(
      (item) => (!item.moreOnMobile && !item.onlyDesktop) || item.name === MORE_SEPARATOR_NAME
    );
    const mobileNavigationMoreItems = items.filter(
      (item) => item.moreOnMobile && !item.onlyDesktop && item.name !== MORE_SEPARATOR_NAME
    );

    return { desktopNavigationItems, mobileNavigationBottomItems, mobileNavigationMoreItems };
  }, [isPlatformNavigation, orgBranding]);
};

type TIntegrationRequest = {
  account_name: string;
  account_user_id: number;
  account_user_email: string;
};
export const Navigation = ({ isPlatformNavigation = false }: { isPlatformNavigation?: boolean }) => {
  const { desktopNavigationItems } = useNavigationItems(isPlatformNavigation);
  const { data: user } = useMeQuery();

  const [integrationRequests, setIntegrationRequests] = useState<TIntegrationRequest[]>([]);

  useEffect(() => {
    const userMeta = isPrismaObjOrUndefined(user?.metadata);
    if (userMeta) {
      setIntegrationRequests((userMeta.chat_integration_requests as TIntegrationRequest[]) ?? []);
    }
  }, [user]);

  const { t } = useLocale();

  const [loadingBtn, setLoadingBtn] = useState<string>("");

  const handleReq = async (account_user_id: number, accept: boolean) => {
    try {
      setLoadingBtn(`${account_user_id}-${accept ? "a" : "r"}`);
      const cal_user_id = user?.id;
      if (!cal_user_id) return;
      const res = await fetch("/api/integrations/oh/chat/internal", {
        method: "POST",
        body: JSON.stringify({
          cal_user_id,
          account_user_id,
          status: accept,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        showToast("Failed to handle request", "error");
        return;
      }
      const data = await res.json();
      showToast(data.message, "success");
      setIntegrationRequests((prev) => {
        return prev.filter((el) => el.account_user_id !== account_user_id);
      });
    } finally {
      setLoadingBtn("");
    }
  };
  return (
    <nav className="mt-2 flex-1 md:px-2 lg:mt-4 lg:px-0">
      {desktopNavigationItems.map((item) => (
        <NavigationItem key={item.name} item={item} />
      ))}
      <div className="text-subtle mt-0.5 lg:hidden">
        <KBarTrigger />
      </div>
      <AllProducts />

      {integrationRequests?.length > 0 && (
        <div className="md:px-2 md:py-1.5">
          <Tooltip side="top" content={t("chat_integration_desc")}>
            <div className="flex gap-3 md:hidden md:gap-2 lg:flex ">
              <Icon name="webhook" className="h-4 w-4" />
              <span className="text-default text-sm">Chat Integrations</span>
            </div>
          </Tooltip>

          <div className="scrollbar-none max-h-[400px] overflow-y-auto overflow-x-hidden">
            {integrationRequests.map((req) => (
              <div key={req.account_user_id} className="my-2 rounded-md border p-2">
                <div className="mb-2 text-sm font-normal">
                  <p className="break-words">
                    {`${t("email")} :`} <span className="text-default">{`${req.account_user_email}`}</span>
                  </p>
                  <p>
                    Account : <span className="text-default capitalize">{`${req.account_name}`}</span>
                  </p>
                </div>

                <div className="space-between flex gap-2">
                  <Button
                    size="sm"
                    loading={loadingBtn === `${req.account_user_id}-a`}
                    disabled={loadingBtn.includes(`${req.account_user_id}`)}
                    onClick={() => {
                      handleReq(req.account_user_id, true);
                    }}
                    color="secondary">
                    <span className="text-sm font-normal">Accept</span>
                  </Button>
                  <Button
                    size="sm"
                    loading={loadingBtn === `${req.account_user_id}-r`}
                    disabled={loadingBtn.includes(`${req.account_user_id}`)}
                    onClick={() => {
                      handleReq(req.account_user_id, false);
                    }}
                    color="destructive">
                    <span className="text-sm font-normal">Reject</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export function MobileNavigationContainer({
  isPlatformNavigation = false,
}: {
  isPlatformNavigation?: boolean;
}) {
  const { status } = useSession();
  if (status !== "authenticated") return null;
  return <MobileNavigation isPlatformNavigation={isPlatformNavigation} />;
}

const MobileNavigation = ({ isPlatformNavigation = false }: { isPlatformNavigation?: boolean }) => {
  const isEmbed = useIsEmbed();
  const { mobileNavigationBottomItems } = useNavigationItems(isPlatformNavigation);

  return (
    <>
      <nav
        className={classNames(
          "pwa:pb-[max(0.625rem,env(safe-area-inset-bottom))] pwa:-mx-2 bg-muted border-subtle fixed bottom-0 left-0 z-30 flex w-full border-t bg-opacity-40 px-1 shadow backdrop-blur-md md:hidden",
          isEmbed && "hidden"
        )}>
        {mobileNavigationBottomItems.map((item) => (
          <MobileNavigationItem key={item.name} item={item} />
        ))}
      </nav>
      {/* add padding to content for mobile navigation*/}
      <div className="block pt-12 md:hidden" />
    </>
  );
};

export const MobileNavigationMoreItems = () => {
  const { mobileNavigationMoreItems } = useNavigationItems();

  return (
    <ul className="border-subtle mt-2 rounded-md border">
      {mobileNavigationMoreItems.map((item) => (
        <MobileNavigationMoreItem key={item.name} item={item} />
      ))}
    </ul>
  );
};
