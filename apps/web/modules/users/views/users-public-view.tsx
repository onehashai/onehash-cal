"use client";

import classNames from "classnames";
import { Calendar, Clock, MessageCircle, Link as LinkIcon } from "lucide-react";
import type { InferGetServerSidePropsType } from "next";
import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useEffect } from "react";
import * as React from "react";
import { Toaster } from "react-hot-toast";

import {
  sdkActionManager,
  useEmbedNonStylesConfig,
  useEmbedStyles,
  useIsEmbed,
} from "@calcom/embed-core/embed-iframe";
import {
  EventTypeDescriptionLazy as EventTypeDescription,
  EventTypeIconCard,
} from "@calcom/features/eventtypes/components";
import EmptyPage from "@calcom/features/eventtypes/components/EmptyPage";
import { getOrgFullOrigin } from "@calcom/features/oe/organizations/lib/orgDomains";
import { isPrismaObjOrUndefined } from "@calcom/lib";
import { SIGNUP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useRouterQuery } from "@calcom/lib/hooks/useRouterQuery";
import useTheme from "@calcom/lib/hooks/useTheme";
import { Design } from "@calcom/prisma/client";
import { ModernBadge, Button, HeadSeo, Icon, UnpublishedEntity, UserAvatar } from "@calcom/ui";

import type { UserNotFoundProps, UserFoundProps } from "@server/lib/[user]/getServerSideProps";
import { type getServerSideProps } from "@server/lib/[user]/getServerSideProps";

function UserFoundLegacy(props: UserFoundProps) {
  const { users, profile, eventTypes, markdownStrippedBio, entity, isOrgSEOIndexable } = props;
  const PoweredBy = dynamic(() => import("@calcom/features/oe/components/PoweredBy"));

  const [user] = users; //To be used when we only have a single user, not dynamic group
  useTheme(profile.theme);

  const isBioEmpty = !user.bio || !user.bio.replace("<p><br></p>", "").length;

  const isEmbed = useIsEmbed(props.isEmbed);
  const eventTypeListItemEmbedStyles = useEmbedStyles("eventTypeListItem");
  const shouldAlignCentrallyInEmbed = useEmbedNonStylesConfig("align") !== "left";
  const shouldAlignCentrally = !isEmbed || shouldAlignCentrallyInEmbed;
  const {
    // So it doesn't display in the Link (and make tests fail)
    user: _user,
    orgSlug: _orgSlug,
    redirect: _redirect,
    ...query
  } = useRouterQuery();

  /*
   const telemetry = useTelemetry();
   useEffect(() => {
    if (top !== window) {
      //page_view will be collected automatically by _middleware.ts
      telemetry.event(telemetryEventTypes.embedView, collectPageParameters("/[user]"));
    }
  }, [telemetry, router.asPath]); */

  useEffect(() => {
    if (props.faviconUrl) {
      const defaultFavicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
      defaultFavicons.forEach((link) => link.parentNode?.removeChild(link));
    }
  }, [props.faviconUrl]);

  if (entity.considerUnpublished) {
    return (
      <div className="flex h-full min-h-[calc(100dvh)] items-center justify-center">
        <UnpublishedEntity {...entity} />
      </div>
    );
  }

  const isEventListEmpty = eventTypes.length === 0;
  const isOrg = !!user?.profile?.organization;

  const allowSEOIndexing = isOrg
    ? isOrgSEOIndexable
      ? profile.allowSEOIndexing
      : false
    : profile.allowSEOIndexing;

  return (
    <>
      {props.faviconUrl && (
        <Head>
          <link rel="icon" href={props.faviconUrl} type="image/x-icon" />
        </Head>
      )}
      <HeadSeo
        origin={getOrgFullOrigin(entity.orgSlug ?? null)}
        title={profile.name}
        description={markdownStrippedBio}
        meeting={{
          title: markdownStrippedBio,
          profile: { name: `${profile.name}`, image: user.avatarUrl || null },
          users: [{ username: `${user.username}`, name: `${user.name}` }],
          bannerUrl: props.bannerUrl,
        }}
        nextSeoProps={{
          noindex: !allowSEOIndexing,
          nofollow: !allowSEOIndexing,
        }}
      />

      <div className={classNames(shouldAlignCentrally ? "mx-auto" : "", isEmbed ? "max-w-3xl" : "")}>
        <main
          className={classNames(
            shouldAlignCentrally ? "mx-auto" : "",
            isEmbed ? "border-booker border-booker-width  bg-default rounded-md" : "",
            "max-w-3xl px-4 py-24"
          )}>
          <div className="mb-8 text-center">
            <UserAvatar
              size="xl"
              user={{
                avatarUrl: user.avatarUrl,
                profile: user.profile,
                name: profile.name,
                username: profile.username,
              }}
            />
            <h1 className="font-cal text-emphasis my-1 text-3xl" data-testid="name-title">
              {profile.name}
              {!isOrg && user.verified && (
                <Icon
                  name="badge-check"
                  className="mx-1 -mt-1 inline h-6 w-6 fill-blue-500 text-white dark:text-black"
                />
              )}
              {isOrg && (
                <Icon
                  name="badge-check"
                  className="mx-1 -mt-1 inline h-6 w-6 fill-yellow-500 text-white dark:text-black"
                />
              )}
            </h1>
            {!isBioEmpty && (
              <>
                <div
                  className="  text-subtle break-words text-sm [&_a]:text-blue-500 [&_a]:underline [&_a]:hover:text-blue-600"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: props.safeBio }}
                />
              </>
            )}
          </div>

          <div
            className={classNames("rounded-md ", !isEventListEmpty && "border-subtle border")}
            data-testid="event-types">
            {eventTypes.map((type) => (
              <Link
                key={type.id}
                style={{ display: "flex", ...eventTypeListItemEmbedStyles }}
                prefetch={false}
                href={{
                  pathname: `/${user.profile.username}/${type.slug}`,
                  query,
                }}
                passHref
                onClick={async () => {
                  sdkActionManager?.fire("eventTypeSelected", {
                    eventType: type,
                  });
                }}
                className="bg-default border-subtle dark:bg-muted dark:hover:bg-emphasis hover:bg-muted group relative border-b transition first:rounded-t-md last:rounded-b-md last:border-b-0"
                data-testid="event-type-link">
                <Icon
                  name="arrow-right"
                  className="text-emphasis absolute right-4 top-4 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                />
                {/* Don't prefetch till the time we drop the amount of javascript in [user][type] page which is impacting score for [user] page */}
                <div className="block w-full p-5">
                  <div className="flex flex-wrap items-center">
                    <h2 className="text-default pr-2 text-sm font-semibold">{type.title}</h2>
                  </div>
                  <EventTypeDescription eventType={type} isPublic={true} shortenDescription />
                </div>
              </Link>
            ))}
          </div>

          {isEventListEmpty && <EmptyPage name={profile.name || "User"} />}
          <div key="logo" className={classNames("mt-6 flex w-full justify-center [&_img]:h-[32px]")}>
            <PoweredBy logoOnly hideBranding={props.hideBranding} bannerUrl={props.bannerUrl ?? undefined} />
          </div>
        </main>
        <Toaster position="bottom-right" />
      </div>
    </>
  );
}

function UserNotFound(props: UserNotFoundProps) {
  const { slug } = props;
  const { t } = useLocale();
  const PoweredBy = dynamic(() => import("@calcom/features/oe/components/PoweredBy"));

  return (
    <>
      <HeadSeo
        origin={getOrgFullOrigin(null)}
        title="Oops no one's here"
        description="Register and claim this Cal ID username before it’s gone!"
        nextSeoProps={{
          noindex: true,
          nofollow: true,
        }}
      />
      <div className="flex min-h-screen flex-col items-center justify-center px-10 md:p-0">
        <div className="bg-default w-full max-w-xl rounded-lg p-10 text-center shadow-lg">
          <div className="flex flex-col items-center">
            <h2 className="mt-4 text-3xl font-semibold text-gray-800">No man’s land - Conquer it today!</h2>
            <p className="mt-4 text-lg text-gray-600">
              Claim username <span className="font-semibold">{`'${slug}'`}</span> on{" "}
              <span className="font-semibold">Cal ID</span> now before someone else does! 🗓️🔥
            </p>
          </div>

          <div className="mt-6">
            <Button color="primary" href={SIGNUP_URL} target="_blank">
              {t("register_now")}
            </Button>
          </div>

          <div className="mt-6 text-base text-gray-500">
            Or Lost your way? &nbsp;
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              Log in to your personal space
            </Link>
          </div>
        </div>
        <div key="logo" className={classNames("mt-6 flex w-full justify-center [&_img]:h-[32px]")}>
          <PoweredBy logoOnly />
        </div>
      </div>
    </>
  );
}

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={classNames("bg-card text-card-foreground rounded-lg border shadow-md ", className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={classNames("flex flex-col space-y-1.5 px-5 pt-3", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={classNames("text-md font-semibold leading-none tracking-tight md:text-xl", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={classNames("px-4 pb-3 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={classNames("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

function UserFoundModern(props: UserFoundProps) {
  const { users, eventTypes } = props;

  const [user] = users; //To be used when we only have a single user, not dynamic group

  const {
    // So it doesn't display in the Link (and make tests fail)
    user: _user,
    orgSlug: _orgSlug,
    redirect: _redirect,
    ...query
  } = useRouterQuery();

  function getSafeString(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() !== "" ? value : fallback;
  }
  const PoweredBy = dynamic(() => import("@calcom/features/oe/components/PoweredBy"));

  return (
    <div className="bg-background min-h-screen [zoom:0.75] ">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Tech Elements */}
        <div className="absolute left-10 top-20 opacity-20">
          <Calendar className="h-20 w-20 text-blue-500" />
        </div>
        <div className="absolute right-20 top-40 opacity-20">
          <MessageCircle className="h-16 w-16 text-purple-500" />
        </div>
        <div className="absolute bottom-20 left-20 opacity-20">
          <LinkIcon className="h-14 w-14 text-indigo-500" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-6 md:px-0">
          <div className=" text-center">
            <div className="relative mb-6 inline-block">
              <div className="mx-auto h-32 w-32 overflow-hidden rounded-full shadow-xl ring-4 ring-white">
                <img src={user.avatarUrl ?? ""} alt="Manas Jha" className="h-full w-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-green-500">
                <div className="h-3 w-3 rounded-full bg-white" />
              </div>
            </div>

            <h1 className="mb-4 text-4xl font-bold text-gray-900 md:text-5xl">{user.name}</h1>

            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-600">{user.bio}</p>

            {/* <div className="flex flex-wrap justify-center gap-2 mt-6">
              <Badge variant="secondary" className="px-3 py-1">OneHash</Badge>
              <Badge variant="secondary" className="px-3 py-1">SaaS</Badge>
              <Badge variant="secondary" className="px-3 py-1">CRM Strategy</Badge>
              <Badge variant="secondary" className="px-3 py-1">Consultant</Badge>
            </div> */}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900">Schedule a Meeting</h2>
          <p className="text-lg text-gray-600">Choose the type of conversation that best fits your needs</p>
        </div> */}

        <div className="grid gap-6">
          {eventTypes.map((event, index) => {
            const iconParams = isPrismaObjOrUndefined(isPrismaObjOrUndefined(event.metadata)?.iconParams);
            const iconName = getSafeString(iconParams?.icon, "Calendar");
            const iconColor = getSafeString(iconParams?.color, "text-blue-600");
            return (
              <Card
                key={index}
                className="group border-0 shadow-md transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4">
                    <EventTypeIconCard iconName={iconName} color={iconColor} />
                    <div className="flex-1">
                      <CardTitle className=" font-semibold text-gray-900">{event.title}</CardTitle>
                      {event.descriptionAsSafeHTML && (
                        <div
                          className="mt-2 leading-relaxed text-gray-600"
                          // eslint-disable-next-line react/no-danger
                          dangerouslySetInnerHTML={{
                            __html: event.descriptionAsSafeHTML || "",
                          }}
                        />
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <div className="flex gap-2">
                        {event.metadata?.multipleDuration ? (
                          event.metadata.multipleDuration.map((duration, idx) => (
                            <ModernBadge variant="outline" key={idx} className="text-sm">
                              {duration}
                            </ModernBadge>
                          ))
                        ) : (
                          <ModernBadge variant="outline" className="text-sm">
                            {event.length}
                          </ModernBadge>
                        )}
                      </div>
                    </div>

                    <Link
                      href={{
                        pathname: `/${user.profile.username}/${event.slug}`,
                        query,
                      }}
                      color="primary"
                      className="rounded-lg px-3 py-1.5 text-white transition-all duration-300 hover:scale-105 md:px-6 md:py-2"
                      style={{ backgroundColor: "#4285F4" }}
                      onClick={() => {
                        sdkActionManager?.fire("eventTypeSelected", {
                          eventType: event,
                        });
                      }}>
                      Schedule
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        {/* <div className="mt-16 border-t border-gray-200 py-8 text-center">
          <p className="mb-4 text-gray-500">Powered by modern scheduling technology</p>
          <div className="flex justify-center gap-6 text-sm text-gray-400">
            <span>🔒 Secure</span>
            <span>⚡ Fast</span>
            <span>📱 Mobile Friendly</span>
          </div>
        </div> */}
        <div key="logo" className={classNames("mt-8 flex w-full justify-center [&_img]:h-[48px]")}>
          <PoweredBy logoOnly hideBranding={props.hideBranding} bannerUrl={props.bannerUrl ?? undefined} />
        </div>
      </div>
    </div>
  );
}

export type UserPageProps = InferGetServerSidePropsType<typeof getServerSideProps>;

function UserPage(props: UserPageProps) {
  if (props.userFound) {
    if (props.userFound.design === Design.LEGACY) {
      return <UserFoundLegacy {...props.userFound} />;
    } else {
      return <UserFoundModern {...props.userFound} />;
    }
  } else {
    return <UserNotFound slug={props.userNotFound?.slug || "User"} />;
  }
}

export default UserPage;
