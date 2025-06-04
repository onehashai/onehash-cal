import type { GetServerSidePropsContext } from "next";
import { z } from "zod";

import { getClientSecretFromPayment } from "@calcom/features/ee/payments/pages/getClientSecretFromPayment";
import prisma from "@calcom/prisma";
import { BookingStatus } from "@calcom/prisma/enums";
import { paymentDataSelect } from "@calcom/prisma/selects/payment";
import { EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";
import type { inferSSRProps } from "@calcom/types/inferSSRProps";

import { ssrInit } from "../../../../../apps/web/server/lib/ssr";

export type PaymentPageProps = inferSSRProps<typeof getServerSideProps>;

const requestParamsSchema = z.object({
  uid: z.string(),
});

const createNotFoundResponse = () => ({ notFound: true } as const);

const createRedirectResponse = (targetPath: string) => ({
  redirect: {
    destination: targetPath,
    permanent: false,
  },
});

const transformDateFields = (bookingData: any) => {
  const { startTime: startDateTime, endTime: endDateTime, ...remainingFields } = bookingData;

  return {
    ...remainingFields,
    startTime: startDateTime.toString(),
    endTime: endDateTime.toString(),
  };
};

const extractPaymentData = (rawPaymentRecord: any) => {
  const { data: paymentMetadata, booking: bookingReference, ...paymentCore } = rawPaymentRecord;

  return {
    payment: {
      ...paymentCore,
      data: paymentMetadata as Record<string, unknown>,
    },
    booking: bookingReference,
  };
};

const buildUserProfile = (eventTypeData: any) => {
  const hasUsers = eventTypeData.users.length > 0;
  const hasTeam = Boolean(eventTypeData.team);

  if (!hasUsers && !hasTeam) return null;

  const primaryUser = hasUsers
    ? eventTypeData.users[0]
    : { name: null, theme: null, hideBranding: null, username: null };

  const teamData = eventTypeData.team;

  return {
    name: teamData?.name || primaryUser?.name || null,
    theme: (!teamData?.name && primaryUser?.theme) || null,
    hideBranding: teamData?.hideBranding || primaryUser?.hideBranding || null,
  };
};

const shouldRedirectBooking = (bookingStatus: BookingStatus): boolean => {
  const invalidStatuses: BookingStatus[] = [BookingStatus.CANCELLED, BookingStatus.REJECTED];
  return invalidStatuses.includes(bookingStatus);
};

const validateEventTypeStructure = (eventTypeData: any): boolean => {
  if (!eventTypeData) return false;

  const hasValidUsers = eventTypeData.users.length > 0;
  const hasValidTeam = Boolean(eventTypeData.team);

  return hasValidUsers || hasValidTeam;
};

const fetchPaymentRecord = async (paymentUid: string) => {
  return await prisma.payment.findFirst({
    where: { uid: paymentUid },
    select: paymentDataSelect,
  });
};

const processEventTypeMetadata = (eventTypeData: any) => ({
  ...eventTypeData,
  metadata: EventTypeMetaDataSchema.parse(eventTypeData.metadata),
});

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const ssrInstance = await ssrInit(context);
  const { uid: paymentUid } = requestParamsSchema.parse(context.query);

  const rawPaymentRecord = await fetchPaymentRecord(paymentUid);
  if (!rawPaymentRecord) return createNotFoundResponse();

  const { payment: transactionData, booking: bookingData } = extractPaymentData(rawPaymentRecord);
  if (!bookingData) return createNotFoundResponse();

  const processedBooking = transformDateFields(bookingData);
  const { eventType: eventTypeData } = bookingData;

  if (!validateEventTypeStructure(eventTypeData)) {
    return createNotFoundResponse();
  }

  const userProfile = buildUserProfile(eventTypeData);
  if (!userProfile) return createNotFoundResponse();

  if (shouldRedirectBooking(processedBooking.status)) {
    return createRedirectResponse(`/booking/${processedBooking.uid}`);
  }

  const [primaryUser] = eventTypeData.users.length
    ? eventTypeData.users
    : [{ name: null, theme: null, hideBranding: null, username: null }];

  const processedEventType = processEventTypeMetadata(eventTypeData);
  const clientSecretValue = getClientSecretFromPayment(transactionData);

  return {
    props: {
      user: primaryUser,
      eventType: processedEventType,
      booking: processedBooking,
      trpcState: ssrInstance.dehydrate(),
      payment: transactionData,
      clientSecret: clientSecretValue,
      profile: userProfile,
    },
  };
};
