"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Fragment, useState } from "react";
import { z } from "zod";

import { WipeMyCalActionButton } from "@calcom/app-store/wipemycalother/components";
import dayjs from "@calcom/dayjs";
import ExportBookingsButton from "@calcom/features/bookings/components/ExportBookingsButton";
import { FilterToggle } from "@calcom/features/bookings/components/FilterToggle";
import { FiltersContainer } from "@calcom/features/bookings/components/FiltersContainer";
import type { filterQuerySchema } from "@calcom/features/bookings/lib/useFilterQuery";
import { useFilterQuery } from "@calcom/features/bookings/lib/useFilterQuery";
import Shell from "@calcom/features/shell/Shell";
import { useInViewObserver } from "@calcom/lib/hooks/useInViewObserver";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useParamsWithFallback } from "@calcom/lib/hooks/useParamsWithFallback";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import type { HorizontalTabItemProps, VerticalTabItemProps } from "@calcom/ui";
import { Alert, Button, EmptyScreen, HorizontalTabs, showToast } from "@calcom/ui";

import useMeQuery from "@lib/hooks/useMeQuery";

import BookingListItem from "@components/booking/BookingListItem";
import SkeletonLoader from "@components/booking/SkeletonLoader";

import { validStatuses } from "~/bookings/lib/validStatuses";

type BookingListingStatus = z.infer<NonNullable<typeof filterQuerySchema>>["status"];
type BookingOutput = RouterOutputs["viewer"]["bookings"]["get"]["bookings"][0];
type AllBookingOutput = RouterOutputs["viewer"]["bookings"]["getAll"][0];
type BookingListingByStatusType = "Unconfirmed" | "Cancelled" | "Recurring" | "Upcoming" | "Past";
type BookingExportType = AllBookingOutput & {
  type: BookingListingByStatusType;
  startDate: string;
  interval: string;
};

type RecurringInfo = {
  recurringEventId: string | null;
  count: number;
  firstDate: Date | null;
  bookings: { [key: string]: Date[] };
};

const tabs: (VerticalTabItemProps | HorizontalTabItemProps)[] = [
  {
    name: "upcoming",
    href: "/bookings/upcoming",
  },
  {
    name: "unconfirmed",
    href: "/bookings/unconfirmed",
  },
  {
    name: "recurring",
    href: "/bookings/recurring",
  },
  {
    name: "past",
    href: "/bookings/past",
  },
  {
    name: "cancelled",
    href: "/bookings/cancelled",
  },
];

const descriptionByStatus: Record<NonNullable<BookingListingStatus>, string> = {
  upcoming: "upcoming_bookings",
  recurring: "recurring_bookings",
  past: "past_bookings",
  cancelled: "cancelled_bookings",
  unconfirmed: "unconfirmed_bookings",
};

const querySchema = z.object({
  status: z.enum(validStatuses),
});

export default function Bookings() {
  const params = useParamsWithFallback();
  const { data: filterQuery } = useFilterQuery();
  const { status } = params ? querySchema.parse(params) : { status: "upcoming" as const };
  const {
    t,
    i18n: { language },
  } = useLocale();
  const user = useMeQuery().data;
  const [isFiltersVisible, setIsFiltersVisible] = useState<boolean>(false);
  const query = trpc.viewer.bookings.get.useInfiniteQuery(
    {
      limit: 10,
      filters: {
        ...filterQuery,
        status: filterQuery.status ?? status,
      },
    },
    {
      enabled: true,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  // if (!query.isFetching && query.status === "success") {
  //   console.log(
  //     "query.data",
  //     query.data?.pages.map((page) =>
  //       JSON.stringify({
  //         bookings: page.bookings,
  //         recurringInfo: page.recurringInfo,
  //       })
  //     )
  //   );
  // }

  // Animate page (tab) transitions to look smoothing

  const buttonInView = useInViewObserver(() => {
    if (!query.isFetching && query.hasNextPage && query.status === "success") {
      query.fetchNextPage();
    }
  });

  const { status: _status, ...filterQueryWithoutStatus } = filterQuery;

  // Define the mutation first
  const { mutate: fetchAllBookingsMutation, isPending } = trpc.viewer.bookings.export.useMutation({
    async onSuccess(response) {
      showToast(response.message, "success");
    },
    onError() {
      showToast(t("unexpected_error_try_again"), "error");
    },
  });

  // const handleExportBookings = (allBookings: AllBookingOutput[]) => {
  //   const getTypeAndStartDate = (booking) => {
  //     const endTime = new Date(booking.endTime);
  //     const isUpcoming = endTime >= new Date();
  //     let type: BookingListingByStatusType | null;
  //     let startDate: string;

  //     if (isUpcoming) {
  //       type =
  //         booking.status === BookingStatus.PENDING
  //           ? "Unconfirmed"
  //           : booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.REJECTED
  //           ? "Cancelled"
  //           : booking.recurringEventId !== null
  //           ? "Recurring"
  //           : "Upcoming";

  //       startDate = dayjs(booking.startTime).tz(user?.timeZone).locale(language).format("ddd, D MMM");
  //     } else {
  //       type =
  //         booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.REJECTED
  //           ? "Cancelled"
  //           : "Past";

  //       startDate = dayjs(booking.startTime).tz(user?.timeZone).locale(language).format("D MMMM YYYY");
  //     }

  //     return { type, startDate };
  //   };

  //   const allBookingsWithType: BookingExportType[] = allBookings.map((booking) => {
  //     const { type, startDate } = getTypeAndStartDate(booking);

  //     const interval = `${formatTime(booking.startTime, user?.timeFormat, user?.timeZone)} to ${formatTime(
  //       booking.endTime,
  //       user?.timeFormat,
  //       user?.timeZone
  //     )}`;

  //     return {
  //       ...booking,
  //       type,
  //       startDate: `"${startDate}"`,
  //       interval,
  //       description: `"${booking.description}"`,
  //     };
  //   });

  //   const header = [
  //     "ID",
  //     "Title",
  //     "Description",
  //     "Status",
  //     "Event",
  //     "Date",
  //     "Interval",
  //     "Location",
  //     "Attendees",
  //     "Paid",
  //     "Currency",
  //     "Amount",
  //     "Payment Status",
  //     "Rescheduled",
  //     "Recurring Event ID",
  //     "Is Recorded",
  //   ];

  //   const formatLocation = (location: string | null) => {
  //     if (location == null) return "N/A";
  //     const cleanLocation = location.includes("integrations:")
  //       ? location
  //           .replace("integrations:", "")
  //           .split(":")
  //           .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  //           .join(" ")
  //           .trim()
  //       : location;

  //     return cleanLocation.includes("\n") ? cleanLocation.replace("\n", " ").trim() : cleanLocation;
  //   };

  //   const csvData = allBookingsWithType.map((booking) => [
  //     booking.id,
  //     booking.title,
  //     booking.description,
  //     booking.type,
  //     booking.eventType?.title ?? "",
  //     booking.startDate,
  //     booking.interval,
  //     formatLocation(booking.location),
  //     booking.attendees.map((attendee) => attendee.email).join(";"),
  //     booking.paid.toString(),
  //     booking.payment.map((pay) => pay.currency).join(";"),
  //     booking.payment.map((pay) => pay.amount / 100).join(";"),
  //     booking.payment.map((pay) => pay.success).join(";"),
  //     booking.rescheduled?.toString() ?? "",
  //     booking.recurringEventId ?? "",
  //     booking.isRecorded.toString(),
  //   ]);

  //   const csvContent = [header.join(","), ...csvData.map((row) => row.join(","))].join("\n");

  //   const encodedUri = encodeURI(`data:text/csv;charset=utf-8,${csvContent}`);
  //   const link = document.createElement("a");
  //   link.setAttribute("href", encodedUri);
  //   link.setAttribute("download", "all-bookings.csv");
  //   document.body.appendChild(link);
  //   link.click();
  //   document.body.removeChild(link);
  // };

  // Define the export bookings function after the mutation

  const handleOnClickExportBookings = async () => {
    fetchAllBookingsMutation({
      filters: {
        ...filterQueryWithoutStatus,
      },
    });
    return;
  };

  const isEmpty = !query.data?.pages[0]?.bookings.length;

  const shownBookings: Record<string, BookingOutput[]> = {};
  const filterBookings = (booking: BookingOutput) => {
    if (status === "recurring" || status == "unconfirmed" || status === "cancelled") {
      if (!booking.recurringEventId) {
        return true;
      }
      if (
        shownBookings[booking.recurringEventId] !== undefined &&
        shownBookings[booking.recurringEventId].length > 0
      ) {
        shownBookings[booking.recurringEventId].push(booking);
        return false;
      }
      shownBookings[booking.recurringEventId] = [booking];
    } else if (status === "upcoming") {
      return (
        dayjs(booking.startTime).tz(user?.timeZone).format("YYYY-MM-DD") !==
        dayjs().tz(user?.timeZone).format("YYYY-MM-DD")
      );
    }
    return true;
  };

  let recurringInfoToday: RecurringInfo | undefined;

  const bookingsToday =
    query.data?.pages.map((page) =>
      page.bookings.filter((booking: BookingOutput) => {
        recurringInfoToday = page.recurringInfo.find(
          (info) => info.recurringEventId === booking.recurringEventId
        );
        return (
          dayjs(booking.startTime).tz(user?.timeZone).format("YYYY-MM-DD") ===
          dayjs().tz(user?.timeZone).format("YYYY-MM-DD")
        );
      })
    )[0] || [];

  const [animationParentRef] = useAutoAnimate<HTMLDivElement>();

  return (
    <Shell
      withoutMain={false}
      hideHeadingOnMobile
      heading={t("bookings")}
      subtitle={t("bookings_description")}
      title={t("bookings")}
      description={t("bookings_description")}>
      <div className="flex flex-col">
        <div className="flex flex-row flex-wrap justify-between">
          <HorizontalTabs tabs={tabs} />
          <div className="flex flex-wrap gap-2">
            <FilterToggle setIsFiltersVisible={setIsFiltersVisible} />
            <ExportBookingsButton
              handleOnClickExportBookings={handleOnClickExportBookings}
              isLoading={isPending}
            />
          </div>
        </div>
        <FiltersContainer isFiltersVisible={isFiltersVisible} />
        <main className="w-full">
          <div className="flex w-full flex-col" ref={animationParentRef}>
            {query.status === "error" && (
              <Alert severity="error" title={t("something_went_wrong")} message={query.error.message} />
            )}
            {(query.status === "pending" || query.isPaused) && <SkeletonLoader />}
            {query.status === "success" && !isEmpty && (
              <>
                {!!bookingsToday.length && status === "upcoming" && (
                  <div className="mb-6 pt-2 xl:pt-0">
                    <WipeMyCalActionButton bookingStatus={status} bookingsEmpty={isEmpty} />
                    <p className="text-subtle mb-2 text-xs font-medium uppercase leading-4">{t("today")}</p>
                    <div className="border-subtle overflow-hidden rounded-md border">
                      <table className="w-full max-w-full table-fixed">
                        <tbody className="bg-default divide-subtle divide-y" data-testid="today-bookings">
                          <Fragment>
                            {bookingsToday.map((booking: BookingOutput) => (
                              <BookingListItem
                                key={booking.id}
                                loggedInUser={{
                                  userId: user?.id,
                                  userTimeZone: user?.timeZone,
                                  userTimeFormat: user?.timeFormat,
                                  userEmail: user?.email,
                                }}
                                listingStatus={status}
                                recurringInfo={recurringInfoToday}
                                {...booking}
                              />
                            ))}
                          </Fragment>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="pt-2 xl:pt-0">
                  <div className="border-subtle overflow-hidden rounded-md border">
                    <table data-testid={`${status}-bookings`} className="w-full max-w-full table-fixed">
                      <tbody className="bg-default divide-subtle divide-y" data-testid="bookings">
                        {query.data.pages.map((page, index) => (
                          <Fragment key={index}>
                            {page.bookings.filter(filterBookings).map((booking: BookingOutput) => {
                              const recurringInfo = page.recurringInfo.find(
                                (info) => info.recurringEventId === booking.recurringEventId
                              );
                              return (
                                <BookingListItem
                                  key={booking.id}
                                  loggedInUser={{
                                    userId: user?.id,
                                    userTimeZone: user?.timeZone,
                                    userTimeFormat: user?.timeFormat,
                                    userEmail: user?.email,
                                  }}
                                  listingStatus={status}
                                  recurringInfo={recurringInfo}
                                  {...booking}
                                />
                              );
                            })}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-default p-4 text-center" ref={buttonInView.ref}>
                    <Button
                      color="minimal"
                      loading={query.isFetchingNextPage}
                      disabled={!query.hasNextPage}
                      onClick={() => query.fetchNextPage()}>
                      {query.hasNextPage ? t("load_more_results") : t("no_more_results")}
                    </Button>
                  </div>
                </div>
              </>
            )}
            {query.status === "success" && isEmpty && (
              <div className="flex items-center justify-center pt-2 xl:pt-0">
                <EmptyScreen
                  Icon="calendar"
                  headline={t("no_status_bookings_yet", { status: t(status).toLowerCase() })}
                  description={t("no_status_bookings_yet_description", {
                    status: t(status).toLowerCase(),
                    description: t(descriptionByStatus[status]),
                  })}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </Shell>
  );
}
