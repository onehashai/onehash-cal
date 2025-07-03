"use client";

import classNames from "classnames";
import type { InferGetServerSidePropsType } from "next";
import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";

import {
  sdkActionManager,
  useEmbedNonStylesConfig,
  useEmbedStyles,
  useIsEmbed,
} from "@calcom/embed-core/embed-iframe";
import { getOrgFullOrigin } from "@calcom/features/ee/organizations/lib/orgDomains";
import { EventTypeDescriptionLazy as EventTypeDescription } from "@calcom/features/eventtypes/components";
import EmptyPage from "@calcom/features/eventtypes/components/EmptyPage";
import { SIGNUP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useRouterQuery } from "@calcom/lib/hooks/useRouterQuery";
import useTheme from "@calcom/lib/hooks/useTheme";
import { Button, HeadSeo, Icon, UnpublishedEntity, UserAvatar } from "@calcom/ui";

import type { UserNotFoundProps, UserFoundProps } from "@server/lib/[user]/getServerSideProps";
import { type getServerSideProps } from "@server/lib/[user]/getServerSideProps";

function UserFound(props: UserFoundProps) {
  const { users, profile, eventTypes, markdownStrippedBio, entity, isOrgSEOIndexable } = props;

  const BrandingComponent = dynamic(() => import("@onehash/oe_features/branding/BrandingComponent"));

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
            <BrandingComponent
              logoOnly
              hideBranding={props.hideBranding}
              bannerUrl={props.bannerUrl ?? undefined}
            />
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
  const BrandingComponent = dynamic(() => import("@onehash/oe_features/branding/BrandingComponent"));

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
          <BrandingComponent logoOnly />
        </div>
      </div>
    </>
  );
}

export type UserPageProps = InferGetServerSidePropsType<typeof getServerSideProps>;

function UserPage(props: UserPageProps) {
  return props.userFound ? (
    <UserFound {...props.userFound} />
  ) : (
    <UserNotFound slug={props.userNotFound?.slug || "User"} />
  );
}

export default UserPage;
