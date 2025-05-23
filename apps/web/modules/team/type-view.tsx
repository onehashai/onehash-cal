"use client";

import Head from "next/head";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Booker } from "@calcom/atoms/monorepo";
import { getBookerWrapperClasses } from "@calcom/features/bookings/Booker/utils/getBookerWrapperClasses";
import { BookerSeo } from "@calcom/features/bookings/components/BookerSeo";

import type { getServerSideProps } from "@lib/team/[slug]/[type]/getServerSideProps";
import type { inferSSRProps } from "@lib/types/inferSSRProps";
import type { EmbedProps } from "@lib/withEmbedSsr";

export type PageProps = inferSSRProps<typeof getServerSideProps> & EmbedProps;

export const getMultipleDurationValue = (
  multipleDurationConfig: number[] | undefined,
  queryDuration: string | string[] | null | undefined,
  defaultValue: number
) => {
  if (!multipleDurationConfig) return null;
  if (multipleDurationConfig.includes(Number(queryDuration))) return Number(queryDuration);
  return defaultValue;
};

function Type({
  slug,
  user,
  booking,
  isEmbed,
  isBrandingHidden,
  eventData,
  isInstantMeeting,
  orgBannerUrl,
  teamMemberEmail,
  crmOwnerRecordType,
  crmAppSlug,
  isSEOIndexable,
  bannerUrl,
  faviconUrl,
}: PageProps) {
  const searchParams = useSearchParams();
  const { profile, users, hidden, title } = eventData;
  useEffect(() => {
    if (faviconUrl) {
      const defaultFavicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
      defaultFavicons.forEach((link) => link.parentNode?.removeChild(link));
    }
  }, [faviconUrl]);
  return (
    <>
      {faviconUrl && (
        <Head>
          <link rel="icon" href={faviconUrl} type="image/x-icon" />
        </Head>
      )}
      <main className={getBookerWrapperClasses({ isEmbed: !!isEmbed })}>
        <BookerSeo
          username={user}
          eventSlug={slug}
          rescheduleUid={booking?.uid}
          hideBranding={isBrandingHidden}
          isTeamEvent
          eventData={
            profile && users && title && hidden !== undefined
              ? {
                  profile,
                  users,
                  title,
                  hidden,
                }
              : undefined
          }
          entity={eventData.entity}
          bookingData={booking}
          isSEOIndexable={isSEOIndexable}
        />
        <Booker
          username={user}
          eventSlug={slug}
          bookingData={booking}
          isInstantMeeting={isInstantMeeting}
          hideBranding={isBrandingHidden}
          isTeamEvent
          entity={{ ...eventData.entity, eventTypeId: eventData?.eventTypeId }}
          durationConfig={eventData.metadata?.multipleDuration}
          /* TODO: Currently unused, evaluate it is needed-
           *       Possible alternative approach is to have onDurationChange.
           */
          duration={getMultipleDurationValue(
            eventData.metadata?.multipleDuration,
            searchParams?.get("duration"),
            eventData.length
          )}
          orgBannerUrl={orgBannerUrl}
          teamMemberEmail={teamMemberEmail}
          crmOwnerRecordType={crmOwnerRecordType}
          crmAppSlug={crmAppSlug}
          bannerUrl={bannerUrl}
        />
      </main>
    </>
  );
}

Type.isBookingPage = true;

export default Type;
