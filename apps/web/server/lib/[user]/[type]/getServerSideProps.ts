import type { DehydratedState } from "@tanstack/react-query";
import { type GetServerSidePropsContext } from "next";
import type { Session } from "next-auth";
import { z } from "zod";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { getBookingForReschedule, getBookingForSeatedEvent } from "@calcom/features/bookings/lib/get-booking";
import type { GetBookingType } from "@calcom/features/bookings/lib/get-booking";
import { orgDomainConfig } from "@calcom/features/ee/organizations/lib/orgDomains";
import type { getPublicEvent } from "@calcom/features/eventtypes/lib/getPublicEvent";
import { isPrismaObjOrUndefined } from "@calcom/lib";
import { getUsernameList } from "@calcom/lib/defaultEvents";
import { UserRepository } from "@calcom/lib/server/repository/user";
import slugify from "@calcom/lib/slugify";
import prisma from "@calcom/prisma";
import { RedirectType } from "@calcom/prisma/client";

import { getTemporaryOrgRedirect } from "@lib/getTemporaryOrgRedirect";

type Props = {
  eventData: Omit<
    Pick<
      NonNullable<Awaited<ReturnType<typeof getPublicEvent>>>,
      "id" | "length" | "metadata" | "entity" | "profile" | "title" | "users" | "hidden"
    >,
    "profile" | "users"
  > & {
    profile: {
      image: string | null;
      name: string | null;
      username: string | null;
    };
    users: {
      username: string;
      name: string;
    }[];
  };

  booking?: GetBookingType;
  rescheduleUid: string | null;
  bookingUid: string | null;
  user: string;
  slug: string;
  trpcState: DehydratedState;
  isBrandingHidden: boolean;
  isSEOIndexable: boolean | null;
  themeBasis: null | string;
  orgBannerUrl: null;
  bannerUrl?: string | null;
  faviconUrl?: string | null;
};

async function processReschedule({
  props,
  rescheduleUid,
  session,
}: {
  props: Props;
  session: Session | null;
  rescheduleUid: string | string[] | undefined;
}) {
  if (!rescheduleUid) return;
  const booking = await getBookingForReschedule(`${rescheduleUid}`, session?.user?.id);
  // if no booking found, no eventTypeId (dynamic) or it matches this eventData - return void (success).
  if (booking === null || !booking.eventTypeId || booking?.eventTypeId === props.eventData?.id) {
    props.booking = booking;
    props.rescheduleUid = Array.isArray(rescheduleUid) ? rescheduleUid[0] : rescheduleUid;
    return;
  }
  // handle redirect response
  const redirectEventTypeTarget = await prisma.eventType.findUnique({
    where: {
      id: booking.eventTypeId,
    },
    select: {
      slug: true,
    },
  });
  if (!redirectEventTypeTarget) {
    return {
      notFound: true,
    } as const;
  }
  return {
    redirect: {
      permanent: false,
      destination: redirectEventTypeTarget.slug,
    },
  };
}

async function processSeatedEvent({
  props,
  bookingUid,
}: {
  props: Props;
  bookingUid: string | string[] | undefined;
}) {
  if (!bookingUid) return;
  props.booking = await getBookingForSeatedEvent(`${bookingUid}`);
  props.bookingUid = Array.isArray(bookingUid) ? bookingUid[0] : bookingUid;
}

async function getDynamicGroupPageProps(context: GetServerSidePropsContext) {
  const { user: usernames, type: slug } = paramsSchema.parse(context.params);
  const { rescheduleUid, bookingUid } = context.query;

  const { ssrInit } = await import("@server/lib/ssr");
  const ssr = await ssrInit(context);
  const { currentOrgDomain, isValidOrgDomain } = orgDomainConfig(context.req, context.params?.orgSlug);
  const org = isValidOrgDomain ? currentOrgDomain : null;
  if (!org) {
    const redirect = await getTemporaryOrgRedirect({
      slugs: usernames,
      redirectType: RedirectType.User,
      eventTypeSlug: slug,
      currentQuery: context.query,
    });

    if (redirect) {
      return redirect;
    }
  }

  const usersInOrgContext = await UserRepository.findUsersByUsername({
    usernameList: usernames,
    orgSlug: isValidOrgDomain ? currentOrgDomain : null,
  });

  const users = usersInOrgContext;

  if (!users.length) {
    return {
      notFound: true,
    } as const;
  }

  // We use this to both prefetch the query on the server,
  // as well as to check if the event exist, so we c an show a 404 otherwise.
  const eventData = await ssr.viewer.public.event.fetch({
    username: usernames.join("+"),
    eventSlug: slug,
    org,
    fromRedirectOfNonOrgLink: context.query.orgRedirection === "true",
  });

  if (!eventData) {
    return {
      notFound: true,
    } as const;
  }

  const props: Props = {
    eventData: {
      id: eventData.id,
      entity: eventData.entity,
      length: eventData.length,
      metadata: {
        ...eventData.metadata,
        multipleDuration: [15, 30, 45, 60, 90],
      },
      profile: {
        image: eventData.profile.image ?? null,
        name: eventData.profile.name ?? null,
        username: eventData.profile.username ?? null,
      },
      title: eventData.title,
      users: eventData.users.map((user) => ({ username: user.username ?? "", name: user.name ?? "" })),
      hidden: eventData.hidden,
    },
    user: usernames.join("+"),
    slug,
    trpcState: ssr.dehydrate(),
    isBrandingHidden: false,
    isSEOIndexable: true,
    themeBasis: null,
    bookingUid: bookingUid ? `${bookingUid}` : null,
    rescheduleUid: null,
    orgBannerUrl: null,
  };

  if (rescheduleUid) {
    const session = await getServerSession(context);
    const processRescheduleResult = await processReschedule({ props, rescheduleUid, session });
    if (processRescheduleResult) {
      return processRescheduleResult;
    }
  } else if (bookingUid) {
    await processSeatedEvent({ props, bookingUid });
  }

  return {
    props,
  };
}

async function getUserPageProps(context: GetServerSidePropsContext) {
  const { user: usernames, type: slug } = paramsSchema.parse(context.params);
  const username = usernames[0];
  const { rescheduleUid, bookingUid } = context.query;
  const { currentOrgDomain, isValidOrgDomain } = orgDomainConfig(context.req, context.params?.orgSlug);

  const isOrgContext = currentOrgDomain && isValidOrgDomain;
  if (!isOrgContext) {
    const redirect = await getTemporaryOrgRedirect({
      slugs: usernames,
      redirectType: RedirectType.User,
      eventTypeSlug: slug,
      currentQuery: context.query,
    });

    if (redirect) {
      return redirect;
    }
  }

  const { ssrInit } = await import("@server/lib/ssr");
  const ssr = await ssrInit(context);
  const [user] = await UserRepository.findUsersByUsername({
    usernameList: [username],
    orgSlug: isValidOrgDomain ? currentOrgDomain : null,
  });

  if (!user) {
    return {
      notFound: true,
    } as const;
  }

  const org = isValidOrgDomain ? currentOrgDomain : null;
  // We use this to both prefetch the query on the server,
  // as well as to check if the event exist, so we can show a 404 otherwise.
  const eventData = await ssr.viewer.public.event.fetch({
    username,
    eventSlug: slug,
    org,
    fromRedirectOfNonOrgLink: context.query.orgRedirection === "true",
  });

  if (!eventData) {
    return {
      notFound: true,
    } as const;
  }

  const allowSEOIndexing = org
    ? user?.profile?.organization?.organizationSettings?.allowSEOIndexing
      ? user?.allowSEOIndexing
      : false
    : user?.allowSEOIndexing;

  const props: Props = {
    eventData: {
      id: eventData.id,
      entity: eventData.entity,
      length: eventData.length,
      metadata: eventData.metadata,
      profile: {
        image: eventData.profile.image ?? null,
        name: eventData.profile.name ?? null,
        username: eventData.profile.username ?? null,
      },
      title: eventData.title,
      users: eventData.users.map((user) => ({ username: user.username ?? "", name: user.name ?? "" })),
      hidden: eventData.hidden,
    },
    user: username,
    slug,
    trpcState: ssr.dehydrate(),
    isBrandingHidden: user?.hideBranding,
    isSEOIndexable: allowSEOIndexing,
    themeBasis: username,
    bookingUid: bookingUid ? `${bookingUid}` : null,
    rescheduleUid: null,
    orgBannerUrl: eventData?.owner?.profile?.organization?.bannerUrl ?? null,
    bannerUrl: user?.bannerUrl,
    faviconUrl: user?.faviconUrl,
  };

  if (rescheduleUid) {
    const session = await getServerSession(context);
    const processRescheduleResult = await processReschedule({ props, rescheduleUid, session });
    if (processRescheduleResult) {
      return processRescheduleResult;
    }
  } else if (bookingUid) {
    await processSeatedEvent({ props, bookingUid });
  }
  //Checking if billing address is required for paid events integrated with stripe
  if (eventData?.metadata?.apps?.stripe?.enabled) {
    const credential = await prisma.credential.findUnique({
      where: {
        id: eventData.metadata?.apps?.stripe?.credentialId,
      },
    });
    const isIndianStripeAccount = isPrismaObjOrUndefined(credential?.key)?.default_currency === "inr";

    if (isIndianStripeAccount) {
      props.eventData.metadata = Object.assign({}, props.eventData?.metadata, {
        billingAddressRequired: true,
      });
    }
  }
  return {
    props,
  };
}

const paramsSchema = z.object({
  type: z.string().transform((s) => slugify(s)),
  user: z.string().transform((s) => getUsernameList(s)),
});

// Booker page fetches a tiny bit of data server side, to determine early
// whether the page should show an away state or dynamic booking not allowed.
export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { req } = context;

  const selectedTime = req.cookies["selectedTime"] || "";
  const slot = context.query.slot || "";

  if (slot && slot !== selectedTime) {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers["host"];
    const originalUrl = req.url;
    const fullUrl = `${protocol}://${host}${originalUrl}`;
    if (fullUrl) {
      const url = new URL(fullUrl);
      url.searchParams.delete("slot");
      return {
        redirect: {
          permanent: false,
          destination: url.toString(),
        },
      };
    }
  }
  const { user } = paramsSchema.parse(context.params);
  const isDynamicGroup = user.length > 1;

  return isDynamicGroup ? await getDynamicGroupPageProps(context) : await getUserPageProps(context);
};
