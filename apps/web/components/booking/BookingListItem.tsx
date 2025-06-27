import type { AssignmentReason } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type {
  DefaultEventLocationType,
  EventLocationTypeFromApp,
  getEventLocationValue,
} from "@calcom/app-store/locations";
import { getSuccessPageLocationMessage, guessEventLocationType } from "@calcom/app-store/locations";
import dayjs from "@calcom/dayjs";
// TODO: Use browser locale, implement Intl in Dayjs maybe?
import "@calcom/dayjs/locales";
import { SystemField, TITLE_FIELD } from "@calcom/features/bookings/lib/SystemField";
import ViewRecordingsDialog from "@calcom/features/ee/video/ViewRecordingsDialog";
import classNames from "@calcom/lib/classNames";
import { formatTime } from "@calcom/lib/date-fns";
import getPaymentAppData from "@calcom/lib/getPaymentAppData";
import { useCopy } from "@calcom/lib/hooks/useCopy";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useGetTheme } from "@calcom/lib/hooks/useTheme";
import { isPrismaObjOrUndefined } from "@calcom/lib/isPrismaObj";
import isSmsCalEmail from "@calcom/lib/isSmsCalEmail";
import { getEveryFreqFor } from "@calcom/lib/recurringStrings";
import { BookingStatus, SchedulingType } from "@calcom/prisma/enums";
import { bookingMetadataSchema } from "@calcom/prisma/zod-utils";
import type { RouterInputs, RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import type { Ensure } from "@calcom/types/utils";
import type { ActionType } from "@calcom/ui";
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  Icon,
  MeetingTimeInTimezones,
  showToast,
  TableActions,
  TextAreaField,
  Tooltip,
  Dropdown,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@calcom/ui";

import assignmentReasonBadgeTitleMap from "@lib/booking/assignmentReasonBadgeTitleMap";

import { AddGuestsDialog } from "@components/dialog/AddGuestsDialog";
import { ChargeCardDialog } from "@components/dialog/ChargeCardDialog";
import { EditLocationDialog } from "@components/dialog/EditLocationDialog";
import { MarkNoShowDialog } from "@components/dialog/MarkNoShowDialog";
import { MeetingNotesDialog } from "@components/dialog/MeetingNotesDialog";
import { ReassignDialog } from "@components/dialog/ReassignDialog";
import { RerouteDialog } from "@components/dialog/RerouteDialog";
import { RescheduleDialog } from "@components/dialog/RescheduleDialog";

type BookingListingStatus = RouterInputs["viewer"]["bookings"]["get"]["filters"]["status"];

type BookingItem = RouterOutputs["viewer"]["bookings"]["get"]["bookings"][number];

type BookingItemProps = BookingItem & {
  listingStatus: BookingListingStatus;
  recurringInfo: RouterOutputs["viewer"]["bookings"]["get"]["recurringInfo"][number] | undefined;
  loggedInUser: {
    userId: number | undefined;
    userTimeZone: string | undefined;
    userTimeFormat: number | null | undefined;
    userEmail: string | undefined;
  };
};

type ParsedBooking = ReturnType<typeof buildParsedBooking>;
type TeamEvent = Ensure<NonNullable<ParsedBooking["eventType"]>, "team">;
type TeamEventBooking = Omit<ParsedBooking, "eventType"> & {
  eventType: TeamEvent;
};
type ReroutableBooking = Ensure<TeamEventBooking, "routedFromRoutingFormReponse">;

function buildParsedBooking(booking: BookingItemProps) {
  // The way we fetch bookings there could be eventType object even without an eventType, but id confirms its existence
  const bookingEventType = booking.eventType.id
    ? (booking.eventType as Ensure<
        typeof booking.eventType,
        // It would only ensure that the props are present, if they are optional in the original type. So, it is safe to assert here.
        "id" | "length" | "title" | "slug" | "schedulingType" | "team"
      >)
    : null;

  const bookingMetadata = bookingMetadataSchema.parse(booking.metadata ?? null);
  return {
    ...booking,
    eventType: bookingEventType,
    metadata: bookingMetadata,
  };
}

const isBookingReroutable = (booking: ParsedBooking): booking is ReroutableBooking => {
  // We support only team bookings for now for rerouting
  // Though `routedFromRoutingFormReponse` could be there for a non-team booking, we don't want to support it for now.
  // Let's not support re-routing for a booking without an event-type for now.
  // Such a booking has its event-type deleted and there might not be something to reroute to.
  return !!booking.routedFromRoutingFormReponse && !!booking.eventType?.team;
};

function BookingListItem(booking: BookingItemProps) {
  const parsedBooking = buildParsedBooking(booking);

  const { userId, userTimeZone, userTimeFormat, userEmail } = booking.loggedInUser;
  //TODO:INSTANT MEETING
  let isOrganizer = false;

  if (booking.user) {
    isOrganizer = booking.user.id === userId || !!booking.eventType.team;
  }
  const {
    t,
    i18n: { language },
  } = useLocale();
  const utils = trpc.useUtils();
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [rejectionDialogIsOpen, setRejectionDialogIsOpen] = useState(false);
  const [chargeCardDialogIsOpen, setChargeCardDialogIsOpen] = useState(false);
  // const [viewRecordingsDialogIsOpen, setViewRecordingsDialogIsOpen] = useState<boolean>(false);
  const [markNoShowDialogIsOpen, setMarkNoShowDialogIsOpen] = useState<boolean>(false);

  const [isNoShowDialogOpen, setIsNoShowDialogOpen] = useState<boolean>(false);
  const cardCharged = booking?.payment[0]?.success;
  const mutation = trpc.viewer.bookings.confirm.useMutation({
    onSuccess: (data) => {
      if (data?.status === BookingStatus.REJECTED) {
        setRejectionDialogIsOpen(false);
        showToast(t("booking_rejection_success"), "success");
      } else {
        showToast(t("booking_confirmation_success"), "success");
      }
      utils.viewer.bookings.invalidate();
    },
    onError: () => {
      showToast(t("booking_confirmation_failed"), "error");
      utils.viewer.bookings.invalidate();
    },
  });

  const isUpcoming = new Date(booking.endTime) >= new Date();
  const isOngoing = isUpcoming && new Date() >= new Date(booking.startTime);
  const isBookingInPast = new Date(booking.endTime) < new Date();
  const isCancelled = booking.status === BookingStatus.CANCELLED;
  const isConfirmed = booking.status === BookingStatus.ACCEPTED;
  const isRejected = booking.status === BookingStatus.REJECTED;
  const isPending = booking.status === BookingStatus.PENDING;
  const isRecurring = booking.recurringEventId !== null;
  const isTabRecurring = booking.listingStatus === "recurring";
  const isTabUnconfirmed = booking.listingStatus === "unconfirmed";

  const paymentAppData = getPaymentAppData(booking.eventType);

  const location = booking.location as ReturnType<typeof getEventLocationValue>;
  const parsedMetadata = bookingMetadataSchema.parse(booking?.metadata || {});

  const { videoCallUrl: locationVideoCallUrl, meetingNote, isImported } = parsedMetadata || {};

  const { resolvedTheme, forcedTheme } = useGetTheme();
  const hasDarkTheme = !forcedTheme && resolvedTheme === "dark";
  const eventTypeColor =
    booking.eventType.eventTypeColor &&
    booking.eventType.eventTypeColor[hasDarkTheme ? "darkEventTypeColor" : "lightEventTypeColor"];

  const locationToDisplay = getSuccessPageLocationMessage(
    locationVideoCallUrl ? locationVideoCallUrl : location,
    t,
    booking.status
  );
  const provider = guessEventLocationType(location);
  // let rescheduleLocation: string | undefined;
  // if (typeof booking.responses?.location === "object" && "optionValue" in booking.responses.location) {
  //   rescheduleLocation = booking.responses.location.optionValue;
  // }
  // const rescheduleLocationToDisplay = getSuccessPageLocationMessage(
  //   rescheduleLocation ?? "",
  //   t,
  //   booking.status
  // );

  // const providerName = provider?.label;
  // const rescheduleProviderName = guessEventLocationType(rescheduleLocation)?.label;

  const bookingConfirm = async (confirm: boolean) => {
    let body = {
      bookingId: booking.id,
      confirmed: confirm,
      reason: rejectionReason,
    };
    /**
     * Only pass down the recurring event id when we need to confirm the entire series, which happens in
     * the "Recurring" tab and "Unconfirmed" tab, to support confirming discretionally in the "Recurring" tab.
     */
    if ((isTabRecurring || isTabUnconfirmed) && isRecurring) {
      body = Object.assign({}, body, { recurringEventId: booking.recurringEventId });
    }
    mutation.mutate(body);
  };

  const getSeatReferenceUid = () => {
    if (!booking.seatsReferences[0]) {
      return undefined;
    }
    return booking.seatsReferences[0].referenceUid;
  };

  const pendingActions: ActionType[] = [
    {
      id: "reject",
      label: (isTabRecurring || isTabUnconfirmed) && isRecurring ? t("reject_all") : t("reject"),
      onClick: () => {
        setRejectionDialogIsOpen(true);
      },
      icon: "ban",
      disabled: mutation.isPending,
    },
    // For bookings with payment, only confirm if the booking is paid for
    ...((isPending && !paymentAppData.enabled) ||
    (paymentAppData.enabled && !!paymentAppData.price && booking.paid)
      ? [
          {
            id: "confirm",
            bookingId: booking.id,
            label: (isTabRecurring || isTabUnconfirmed) && isRecurring ? t("confirm_all") : t("confirm"),
            onClick: () => {
              bookingConfirm(true);
            },
            icon: "check" as const,
            disabled: mutation.isPending,
          },
        ]
      : []),
  ];

  const isExtBooking = isPrismaObjOrUndefined(booking.metadata)?.isExternalEvent;

  const reschedule_booking_action = {
    id: "reschedule",
    icon: "clock" as const,
    label: t("reschedule_booking"),
    href: `/reschedule/${booking.uid}${
      booking.seatsReferences.length ? `?seatReferenceUid=${getSeatReferenceUid()}` : ""
    }`,
  };
  const editBookingActions: ActionType[] = [
    ...(isBookingInPast
      ? [
          reschedule_booking_action,
          {
            id: "reschedule_request",
            icon: "send" as const,
            iconClassName: "rotate-45 w-[16px] -translate-x-0.5 ",
            label: t("send_reschedule_request"),
            onClick: () => {
              setIsOpenRescheduleDialog(true);
            },
          },
        ]
      : []),
    ...(isBookingReroutable(parsedBooking)
      ? [
          {
            id: "reroute",
            label: t("reroute"),
            onClick: () => {
              setRerouteDialogIsOpen(true);
            },
            icon: "waypoints" as const,
          },
        ]
      : []),
    {
      id: "change_location",
      label: t("edit_location"),
      onClick: () => {
        setIsOpenLocationDialog(true);
      },
      icon: "map-pin" as const,
    },
    {
      id: "add_members",
      label: t("additional_guests"),
      onClick: () => {
        setIsOpenAddGuestsDialog(true);
      },
      icon: "user-plus" as const,
    },
  ];

  if (booking.eventType.schedulingType === SchedulingType.ROUND_ROBIN) {
    editBookingActions.push({
      id: "reassign ",
      label: t("reassign"),
      onClick: () => {
        setIsOpenReassignDialog(true);
      },
      icon: "users" as const,
    });
  }

  // if (isBookingInPast || isOngoing) {
  //   editBookingActions.push({
  //     id: "no_show",
  //     label: t("mark_as_no_show"),
  //     onClick: () => {
  //       setIsNoShowDialogOpen(true);
  //     },
  //     icon: "eye-off" as const,
  //   });
  // }

  let bookedActions: ActionType[] = [
    ...(!isExtBooking
      ? [
          {
            id: "cancel",
            label: isTabRecurring && isRecurring ? t("cancel_all_remaining") : t("cancel_event"),
            /* When cancelling we need to let the UI and the API know if the intention is to
               cancel all remaining bookings or just that booking instance. */
            href: `/booking/${booking.uid}?cancel=true${
              isTabRecurring && isRecurring ? "&allRemainingBookings=true" : ""
            }${booking.seatsReferences.length ? `&seatReferenceUid=${getSeatReferenceUid()}` : ""}
      `,
            icon: "x" as const,
          },
          {
            id: "edit_booking",
            label: t("edit"),
            actions: editBookingActions,
          },
        ]
      : []),
  ];

  const chargeCardActions: ActionType[] = [
    {
      id: "charge_card",
      label: cardCharged ? t("no_show_fee_charged") : t("collect_no_show_fee"),
      disabled: cardCharged,
      onClick: () => {
        setChargeCardDialogIsOpen(true);
      },
      icon: "credit-card" as const,
    },
  ];

  if (isTabRecurring && isRecurring) {
    bookedActions = bookedActions.filter((action) => action.id !== "edit_booking");
  }

  if (isBookingInPast && isPending && !isConfirmed) {
    bookedActions = bookedActions.filter((action) => action.id !== "cancel");
  }

  const RequestSentMessage = () => {
    return (
      <Badge startIcon="send" size="md" variant="gray" data-testid="request_reschedule_sent">
        {t("reschedule_request_sent")}
      </Badge>
    );
  };

  const startTime = dayjs(booking.startTime)
    .tz(userTimeZone)
    .locale(language)
    .format(isUpcoming ? "ddd, D MMM" : "D MMMM YYYY");
  const [isOpenRescheduleDialog, setIsOpenRescheduleDialog] = useState(false);
  const [isOpenReassignDialog, setIsOpenReassignDialog] = useState(false);
  const [isOpenSetLocationDialog, setIsOpenLocationDialog] = useState(false);
  const [isOpenAddGuestsDialog, setIsOpenAddGuestsDialog] = useState(false);
  const [rerouteDialogIsOpen, setRerouteDialogIsOpen] = useState(false);
  const setLocationMutation = trpc.viewer.bookings.editLocation.useMutation({
    onSuccess: () => {
      showToast(t("location_updated"), "success");
      setIsOpenLocationDialog(false);
      utils.viewer.bookings.invalidate();
    },
    onError: (e) => {
      const errorMessages: Record<string, string> = {
        UNAUTHORIZED: t("you_are_unauthorized_to_make_this_change_to_the_booking"),
        BAD_REQUEST: e.message,
      };

      const message = errorMessages[e.data?.code as string] || t("location_update_failed");
      showToast(message, "error");
    },
  });

  const saveLocation = async ({
    newLocation,
    credentialId,
  }: {
    newLocation: string;
    /**
     * It could be set for conferencing locations that support team level installations.
     */
    credentialId: number | null;
  }) => {
    try {
      await setLocationMutation.mutateAsync({
        bookingId: booking.id,
        newLocation,
        credentialId,
      });
    } catch {
      // Errors are shown through the mutation onError handler
    }
  };

  // Getting accepted recurring dates to show
  const recurringDates = booking.recurringInfo?.bookings[BookingStatus.ACCEPTED]
    .concat(booking.recurringInfo?.bookings[BookingStatus.CANCELLED])
    .concat(booking.recurringInfo?.bookings[BookingStatus.PENDING])
    .sort((date1: Date, date2: Date) => date1.getTime() - date2.getTime());

  // const buildBookingLink = () => {
  //   const urlSearchParams = new URLSearchParams({
  //     allRemainingBookings: isTabRecurring.toString(),
  //   });
  //   if (booking.attendees?.[0]?.email) urlSearchParams.set("email", booking.attendees[0].email);
  //   return `/booking/${booking.uid}?${urlSearchParams.toString()}`;
  // };

  // const bookingLink = buildBookingLink();

  const title = booking.title;

  const showViewRecordingsButton = !!(booking.isRecorded && isBookingInPast && isConfirmed);
  const showCheckRecordingButton =
    isBookingInPast &&
    isConfirmed &&
    !booking.isRecorded &&
    (!booking.location || booking.location === "integrations:daily" || booking?.location?.trim() === "");

  // const showRecordingActions: ActionType[] = [
  //   {
  //     id: "view_recordings",
  //     label: showCheckRecordingButton ? t("check_for_recordings") : t("view_recordings"),
  //     onClick: () => {
  //       setViewRecordingsDialogIsOpen(true);
  //     },
  //     color: showCheckRecordingButton ? "secondary" : "primary",
  //     disabled: mutation.status === "pending",
  //   },
  // ];

  const showPendingPayment = paymentAppData.enabled && booking.payment.length && !booking.paid;
  const [expanded, setExpanded] = useState(false);

  const attendeePhoneNo = isPrismaObjOrUndefined(booking.responses)?.phone as string | undefined;
  const [notes, setNotes] = useState<string>(meetingNote || "");

  const [showRTE, setShowRTE] = useState(false);

  const saveNotesMutation = trpc.viewer.bookings.saveNote.useMutation({
    onSuccess: () => {
      showToast(t("meeting_notes_saved"), "success");
      setIsOpenLocationDialog(false);
    },
  });

  const handleMeetingNoteSave = (): void => {
    saveNotesMutation.mutate({ bookingId: booking.id, meetingNote: notes });
  };

  const openWhatsAppChat = (phoneNumber: string) => {
    // Dimensions and other properties of the popup window
    const width = 800;
    const height = 600;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    const options = `width=${width},height=${height},left=${left},top=${top},resizable,scrollbars=yes,status=1`;

    const generateWhatsAppLink = (phoneNumber: string): string => {
      const cleanedPhoneNumber = phoneNumber.replace(/\D/g, "");
      const urlEndcodedTextMessage = encodeURIComponent(
        `Hi, I'm running late by 5 minutes. I'll be there soon.`
      );

      // this opens the whatsapp web instead of defaulting to whatsapp app (linux doesn't support app)
      // const whatsappLink = `https://web.whatsapp.com/send?phone=${cleanedPhoneNumber}&text=${urlEndcodedTextMessage}`;

      const whatsappLink = `https://api.whatsapp.com/send?phone=${cleanedPhoneNumber}&text=${urlEndcodedTextMessage}`;
      return whatsappLink;
    };
    //Generating the whatsapp link
    const url = generateWhatsAppLink(phoneNumber);
    // Open the popup window with the provided URL and options
    window.open(url, "_blank", options);
  };

  const [attendeeList, setAttendeeList] = useState<AttendeeProps[]>(
    booking.attendees.map((attendee) => {
      return {
        name: attendee.name,
        email: attendee.email,
        id: attendee.id,
        noShow: attendee.noShow || false,
        phoneNumber: attendee.phoneNumber,
      };
    })
  );

  const noShowMutation = trpc.viewer.markNoShow.useMutation({
    onSuccess: async (data) => {
      showToast(t(data.message), "success");
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  const onSubmitNoShow = (data: { attendees: AttendeeProps[] }) => {
    noShowMutation.mutate({ bookingUid: booking.uid, attendees: data.attendees });
    setAttendeeList(data.attendees);
    setMarkNoShowDialogIsOpen(false);
  };
  return (
    <>
      <RescheduleDialog
        isOpenDialog={isOpenRescheduleDialog}
        setIsOpenDialog={setIsOpenRescheduleDialog}
        bookingUId={booking.uid}
      />
      {isOpenReassignDialog && (
        <ReassignDialog
          isOpenDialog={isOpenReassignDialog}
          setIsOpenDialog={setIsOpenReassignDialog}
          bookingId={booking.id}
          teamId={booking.eventType?.team?.id || 0}
        />
      )}
      <EditLocationDialog
        booking={booking}
        saveLocation={saveLocation}
        isOpenDialog={isOpenSetLocationDialog}
        setShowLocationModal={setIsOpenLocationDialog}
        teamId={booking.eventType?.team?.id}
      />
      <AddGuestsDialog
        isOpenDialog={isOpenAddGuestsDialog}
        setIsOpenDialog={setIsOpenAddGuestsDialog}
        bookingId={booking.id}
      />
      {booking.paid && booking.payment[0] && (
        <ChargeCardDialog
          isOpenDialog={chargeCardDialogIsOpen}
          setIsOpenDialog={setChargeCardDialogIsOpen}
          bookingId={booking.id}
          paymentAmount={booking.payment[0].amount}
          paymentCurrency={booking.payment[0].currency}
        />
      )}
      {/* {(showViewRecordingsButton || showCheckRecordingButton) && (
        <ViewRecordingsDialog
          booking={booking}
          isOpenDialog={viewRecordingsDialogIsOpen}
          setIsOpenDialog={setViewRecordingsDialogIsOpen}
          timeFormat={userTimeFormat ?? null}
        />
      )} */}
      <MarkNoShowDialog
        isOpenDialog={markNoShowDialogIsOpen}
        setIsOpenDialog={setMarkNoShowDialogIsOpen}
        attendees={attendeeList}
        onSubmitNoShow={onSubmitNoShow}
      />
      <MeetingNotesDialog
        notes={notes}
        setNotes={setNotes}
        isOpenDialog={showRTE}
        setIsOpenDialog={setShowRTE}
        handleMeetingNoteSave={handleMeetingNoteSave}
      />
      {/* NOTE: Should refactor this dialog component as is being rendered multiple times */}
      {isNoShowDialogOpen && (
        <NoShowAttendeesDialog
          bookingUid={booking.uid}
          attendees={attendeeList}
          setIsOpen={setIsNoShowDialogOpen}
          isOpen={isNoShowDialogOpen}
        />
      )}
      <Dialog open={rejectionDialogIsOpen} onOpenChange={setRejectionDialogIsOpen}>
        <DialogContent title={t("rejection_reason_title")} description={t("rejection_reason_description")}>
          <div>
            <TextAreaField
              name="rejectionReason"
              label={
                <>
                  {t("rejection_reason")}
                  <span className="text-subtle font-normal"> (Optional)</span>
                </>
              }
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <DialogClose />
            <Button
              disabled={mutation.status === "pending"}
              data-testid="rejection-confirm"
              onClick={() => {
                bookingConfirm(false);
              }}>
              {t("rejection_confirmation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <tr
        data-testid="booking-item"
        onClick={() => {
          if (!isOrganizer) return;
          setExpanded(!expanded);
        }}
        className="hover:bg-muted group flex cursor-pointer flex-col sm:flex-row">
        <td className="hidden align-top ltr:pl-6 rtl:pr-6 sm:table-cell sm:min-w-[12rem]">
          <div className="cursor-pointer py-4">
            <div className="text-emphasis text-sm leading-6">{startTime}</div>
            <div className="text-subtle text-sm">
              {formatTime(booking.startTime, userTimeFormat, userTimeZone)} -{" "}
              {formatTime(booking.endTime, userTimeFormat, userTimeZone)}
              <MeetingTimeInTimezones
                timeFormat={userTimeFormat}
                userTimezone={userTimeZone}
                startTime={booking.startTime}
                endTime={booking.endTime}
                attendees={booking.attendees}
              />
            </div>

            {!isPending && <DisplayLocation locationToDisplay={locationToDisplay} provider={provider} />}
            {isPending &&
              (isPrismaObjOrUndefined(booking.metadata)?.paymentStatus === "failed" ? (
                <Badge className="ltr:mr-2 rtl:ml-2" variant="orange">
                  {t("payment_not_created_error")}
                </Badge>
              ) : (
                <Badge className="ltr:mr-2 rtl:ml-2" variant="orange">
                  {t("unconfirmed")}
                </Badge>
              ))}
            {booking.eventType?.team && (
              <Badge className="ltr:mr-2 rtl:ml-2" variant="gray">
                {booking.eventType.team.name}
              </Badge>
            )}

            {booking.paid && !booking.payment[0] ? (
              <Badge className="ltr:mr-2 rtl:ml-2" variant="orange">
                {t("error_collecting_card")}
              </Badge>
            ) : (
              booking.paid &&
              (isPrismaObjOrUndefined(booking.metadata)?.paymentStatus === "refunded" ? (
                <Badge className="ltr:mr-2 rtl:ml-2" variant="green" data-testid="refunded_badge">
                  {t("refunded")}
                </Badge>
              ) : (
                <Badge className="ltr:mr-2 rtl:ml-2" variant="green" data-testid="paid_badge">
                  {booking.payment[0].paymentOption === "HOLD" ? t("card_held") : t("paid")}
                </Badge>
              ))
            )}
            {recurringDates !== undefined && (
              <div className="text-muted mt-2 text-sm">
                <RecurringBookingsTooltip
                  userTimeFormat={userTimeFormat}
                  userTimeZone={userTimeZone}
                  booking={booking}
                  recurringDates={recurringDates}
                />
              </div>
            )}
          </div>
        </td>
        <td
          data-testid="title-and-attendees"
          className={`my-auto flex w-full items-center align-middle px-4${
            isRejected ? " line-through" : ""
          }`}>
          <div>
            {/* Time and Badges for mobile */}
            <div className="w-full pb-2 pt-4 sm:hidden">
              <div className="flex w-full items-center justify-between sm:hidden">
                <div className="text-emphasis text-sm leading-6">{startTime}</div>
                <div className="text-subtle pr-2 text-sm">
                  {formatTime(booking.startTime, userTimeFormat, userTimeZone)} -{" "}
                  {formatTime(booking.endTime, userTimeFormat, userTimeZone)}
                  <MeetingTimeInTimezones
                    timeFormat={userTimeFormat}
                    userTimezone={userTimeZone}
                    startTime={booking.startTime}
                    endTime={booking.endTime}
                    attendees={booking.attendees}
                  />
                </div>
                {booking.description && (
                  <div
                    className="max-w-10/12 text-default sm:max-w-32 md:max-w-52 xl:max-w-80 truncate text-sm"
                    title={booking.description}>
                    &quot;{booking.description}&quot;
                  </div>
                )}
                {/* {booking.attendees.length !== 0 && (
                  <DisplayAttendees
                    attendees={attendeeList}
                    user={booking.user}
                    currentEmail={userEmail}
                    bookingUid={booking.uid}
                    isBookingInPast={isBookingInPast}
                  />
                )} */}
              </div>
              {!isPending && <DisplayLocation locationToDisplay={locationToDisplay} provider={provider} />}
            </div>

            <div className="cursor-pointer py-4">
              <div
                title={title}
                className={classNames(
                  "max-w-10/12 text-emphasis sm:max-w-56 text-sm font-medium leading-6 md:max-w-full",
                  isCancelled ? "line-through" : ""
                )}>
                {title}
                <span> </span>

                {showPendingPayment && (
                  <Badge className="hidden sm:inline-flex" variant="orange">
                    {t("pending_payment")}
                  </Badge>
                )}
              </div>
              {booking.description && (
                <div
                  className="max-w-10/12 text-default sm:max-w-32 md:max-w-52 xl:max-w-80 truncate text-sm"
                  title={booking.description}>
                  &quot;{booking.description}&quot;
                </div>
              )}
              {booking.attendees.length !== 0 && (
                <DisplayAttendees
                  attendees={attendeeList}
                  user={booking.user}
                  currentEmail={userEmail}
                  bookingUid={booking.uid}
                  isBookingInPast={isBookingInPast}
                />
              )}
              {isCancelled && booking.rescheduled && (
                <div className="mt-2 inline-block md:hidden">
                  <RequestSentMessage />
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="flex w-full flex-col flex-wrap items-end justify-end space-x-2 space-y-2 py-4 pl-4 text-right text-sm font-medium ltr:pr-4 rtl:pl-4 sm:flex-row sm:flex-nowrap sm:space-y-0 sm:pl-0 md:items-center">
          {isUpcoming && !isCancelled ? (
            <>
              {isPending && (userId === booking.user?.id || booking.isUserTeamAdminOrOwner) && (
                <TableActions actions={pendingActions} />
              )}
              {isConfirmed && !isExtBooking && <TableActions actions={[reschedule_booking_action]} />}
              {isConfirmed && <TableActions actions={bookedActions} />}
              {isRejected && <div className="text-subtle text-sm">{t("rejected")}</div>}
            </>
          ) : null}
          {isBookingInPast && isPending && !isConfirmed ? <TableActions actions={bookedActions} /> : null}
          {isBookingInPast && isConfirmed ? <TableActions actions={bookedActions} /> : null}
          {/* {(showViewRecordingsButton || showCheckRecordingButton) && (
            <TableActions actions={showRecordingActions} />
          )} */}
          {isCancelled && booking.rescheduled && (
            <div className="hidden h-full items-center md:flex">
              <RequestSentMessage />
            </div>
          )}
          {booking.status === "ACCEPTED" && booking.paid && booking.payment[0]?.paymentOption === "HOLD" && (
            <div className="ml-2">
              <TableActions actions={chargeCardActions} />
            </div>
          )}
          {/* <BookingItemBadges
            booking={booking}
            isPending={isPending}
            recurringDates={recurringDates}
            userTimeFormat={userTimeFormat}
            userTimeZone={userTimeZone}
          /> */}

          {isOrganizer ? (
            <div className="text-md flex items-center pl-3">
              <p className="mt-px">{t("details")}</p>
              <Icon
                name="chevron-right"
                strokeWidth="2"
                className={classNames(" ", expanded ? "rotate-90 transform" : "rotate-0 transform")}
              />
            </div>
          ) : (
            <div className="text-md flex pl-3 ">
              <p className="mt-px">{t("attendee")}</p>
            </div>
          )}
        </td>
      </tr>
      {isBookingReroutable(parsedBooking) && (
        <RerouteDialog
          isOpenDialog={rerouteDialogIsOpen}
          setIsOpenDialog={setRerouteDialogIsOpen}
          booking={{ ...parsedBooking, eventType: parsedBooking.eventType }}
        />
      )}
      {expanded && (
        <div className="px-3 pb-3 md:px-6">
          <hr className="mb-3 h-px border-0 bg-gray-200 dark:bg-gray-700" />

          <div className="flex flex-col justify-between md:flex-row md:gap-3">
            <div className="flex flex-col gap-2 ">
              <div className="flex items-center">
                <div className="mr-4">
                  <p className="text-emphasis text-sm leading-6">{t("event_type")} </p>
                </div>
                <div>
                  <p className="text-subtle text-sm">{booking.eventType.title}</p>
                </div>
              </div>

              <div className="flex flex-row items-center">
                <div className="mr-4">
                  <p className="text-emphasis text-sm leading-6">{t("invitee_name")} </p>
                </div>
                <div>
                  {booking.attendees.map((attendee: any, i: number) => (
                    <p key={attendee.email} className="text-subtle text-sm">
                      {attendee.name && attendee.name}{" "}
                    </p>
                  ))}
                </div>
              </div>

              <div className="flex flex-row items-center">
                <div className="mr-4">
                  <p className="text-emphasis text-sm leading-6">{t("invitee_email")}</p>
                </div>
                <div>
                  {booking.attendees.map((attendee: any) => (
                    <p key={attendee.email} className="text-subtle text-sm">
                      {attendee.email}
                    </p>
                  ))}
                </div>
              </div>
              {attendeePhoneNo && (
                <div className="flex flex-row items-center">
                  <div className="mr-4">
                    <p className="text-emphasis text-sm leading-6">{t("invitee_phone")}</p>
                  </div>
                  <div>
                    <p className="text-subtle text-sm">{attendeePhoneNo}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center">
                <div className="mr-4">
                  <p className="text-emphasis text-sm ">{t("invitee_timezone")} </p>
                </div>
                <div>
                  <p className="text-subtle text-sm">{booking.attendees[0].timeZone}</p>
                </div>
              </div>

              {booking.status === BookingStatus.CANCELLED && (
                <div className="flex items-center">
                  <div className="mr-4">
                    <p className="text-emphasis text-sm ">{t("cancellation_reason")} </p>
                  </div>
                  <div>
                    <p className="text-subtle text-sm">{booking.cancellationReason ?? "N/A"}</p>
                  </div>
                </div>
              )}

              {booking?.description && (
                <div className="flex items-center">
                  <div className="mr-4">
                    <p className="text-emphasis text-sm ">{t("additional_notes")}</p>
                  </div>
                  <div>
                    <p className="text-subtle text-sm">{booking.description}</p>
                  </div>
                </div>
              )}

              {booking.eventType.bookingFields &&
                booking.responses &&
                Object.entries(booking.responses).map(([name, response]) => {
                  const field = Array.isArray(booking.eventType.bookingFields)
                    ? booking.eventType.bookingFields.find((field) => {
                        const obj = isPrismaObjOrUndefined(field); // Returns `field` if it's an object, otherwise `undefined`
                        return (
                          obj &&
                          typeof obj === "object" &&
                          "name" in obj &&
                          typeof obj.name === "string" &&
                          obj.name === name
                        );
                      })
                    : undefined;

                  if (
                    !field ||
                    typeof field !== "object" ||
                    !("name" in field) ||
                    typeof field.name !== "string"
                  )
                    return null;

                  const isSystemField = SystemField.safeParse(field.name); // SMS_REMINDER_NUMBER_FIELD is a system field but doesn't have a dedicated place in the UI. So, it would be shown through the following responses list
                  // TITLE is also an identifier for booking question "What is this meeting about?"
                  if (
                    isSystemField.success &&
                    // field.name !== SMS_REMINDER_NUMBER_FIELD &&
                    field.name !== TITLE_FIELD
                  )
                    return null;

                  const label = String(field.label) || t(String(field.defaultLabel) || "");
                  // const label = t(String(field.defaultLabel) || "");

                  return (
                    <div className="flex items-center" key={label}>
                      <div className="mr-4">
                        <p className="text-emphasis text-sm ">{label}</p>
                      </div>
                      <div>
                        <p className="text-subtle text-sm">
                          {field.type === "boolean" ? (response ? t("yes") : t("no")) : response.toString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="mt-2 flex min-h-full flex-col  justify-center gap-2 ">
              <Button
                className="flex w-full justify-center"
                color="secondary"
                onClick={() => setShowRTE(true)}>
                {t("meeting_notes")}
              </Button>

              {attendeePhoneNo && (
                <Button
                  className="flex w-full justify-center "
                  color="secondary"
                  onClick={() => openWhatsAppChat(attendeePhoneNo)}>
                  {t("whatsapp_chat")}
                </Button>
              )}
              {(isBookingInPast || isOngoing) && !(isImported === "yes" || isExtBooking) && (
                <Button
                  className="flex w-full justify-center "
                  color="secondary"
                  onClick={() => setMarkNoShowDialogIsOpen(true)}>
                  {t("mark_no_show")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const BookingItemBadges = ({
  booking,
  isPending,
  recurringDates,
  userTimeFormat,
  userTimeZone,
}: {
  booking: BookingItemProps;
  isPending: boolean;
  recurringDates: Date[] | undefined;
  userTimeFormat: number | null | undefined;
  userTimeZone: string | undefined;
}) => {
  const { t } = useLocale();

  return (
    <div className="hidden h-9 flex-row pb-4 pl-6 sm:flex">
      {isPending && (
        <Badge className="ltr:mr-2 rtl:ml-2" variant="orange">
          {t("unconfirmed")}
        </Badge>
      )}
      {/* {booking.eventType?.team && (
        <Badge className="ltr:mr-2 rtl:ml-2" variant="gray">
          {booking.eventType.team.name}
        </Badge>
      )} */}
      {booking?.assignmentReason.length > 0 && (
        <AssignmentReasonTooltip assignmentReason={booking.assignmentReason[0]} />
      )}
      {booking.paid && !booking.payment[0] ? (
        <Badge className="ltr:mr-2 rtl:ml-2" variant="orange">
          {t("error_collecting_card")}
        </Badge>
      ) : booking.paid ? (
        <Badge className="ltr:mr-2 rtl:ml-2" variant="green" data-testid="paid_badge">
          {booking.payment[0].paymentOption === "HOLD" ? t("card_held") : t("paid")}
        </Badge>
      ) : null}
      {recurringDates !== undefined && (
        <div className="text-muted mt-2 text-sm">
          <RecurringBookingsTooltip
            userTimeFormat={userTimeFormat}
            userTimeZone={userTimeZone}
            booking={booking}
            recurringDates={recurringDates}
          />
        </div>
      )}
    </div>
  );
};

interface RecurringBookingsTooltipProps {
  booking: BookingItemProps;
  recurringDates: Date[];
  userTimeZone: string | undefined;
  userTimeFormat: number | null | undefined;
}

const RecurringBookingsTooltip = ({
  booking,
  recurringDates,
  userTimeZone,
  userTimeFormat,
}: RecurringBookingsTooltipProps) => {
  const {
    t,
    i18n: { language },
  } = useLocale();
  const now = new Date();
  const recurringCount = recurringDates.filter((recurringDate) => {
    return (
      recurringDate >= now &&
      !booking.recurringInfo?.bookings[BookingStatus.CANCELLED]
        .map((date) => date.toString())
        .includes(recurringDate.toString())
    );
  }).length;

  return (
    (booking.recurringInfo &&
      (booking.eventType?.recurringEvent?.freq ||
        isPrismaObjOrUndefined(booking.metadata)?.isExternalEvent) &&
      (booking.listingStatus === "recurring" ||
        booking.listingStatus === "unconfirmed" ||
        booking.listingStatus === "cancelled") && (
        <div className="underline decoration-gray-400 decoration-dashed underline-offset-2">
          <div className="flex">
            <Tooltip
              content={
                <div className="max-h-48 w-64 overflow-y-auto p-2">
                  {recurringDates.map((aDate, key) => {
                    const pastOrCancelled =
                      aDate < now ||
                      booking.recurringInfo?.bookings[BookingStatus.CANCELLED]
                        .map((date) => date.toString())
                        .includes(aDate.toString());
                    return (
                      <p key={key} className={classNames(pastOrCancelled && "line-through")}>
                        {formatTime(aDate, userTimeFormat, userTimeZone)}
                        {" - "}
                        {dayjs(aDate).locale(language).format("D MMMM YYYY")}
                      </p>
                    );
                  })}
                </div>
              }>
              <div className="text-default">
                <Icon
                  name="refresh-ccw"
                  strokeWidth="3"
                  className="text-muted float-left mr-1 mt-1.5 inline-block h-3 w-3"
                />
                <p className="mt-1 pl-5 text-xs">
                  {booking.status === BookingStatus.ACCEPTED && !booking.eventType?.recurringEvent ? (
                    `${t("event_remaining_other", {
                      count: recurringCount,
                    })}`
                  ) : booking.eventType.recurringEvent != undefined ? (
                    getEveryFreqFor({
                      t,
                      recurringEvent: booking.eventType.recurringEvent,
                      recurringCount: booking.recurringInfo.count,
                    })
                  ) : (
                    <></>
                  )}
                </p>
              </div>
            </Tooltip>
          </div>
        </div>
      )) ||
    null
  );
};

interface UserProps {
  id: number;
  name: string | null;
  email: string;
}

const FirstAttendee = ({
  user,
  currentEmail,
}: {
  user: UserProps;
  currentEmail: string | null | undefined;
}) => {
  const { t } = useLocale();
  return user.email === currentEmail ? (
    <div className="inline-block">{t("you")}</div>
  ) : (
    <a
      key={user.email}
      className=" hover:text-blue-500"
      href={`mailto:${user.email}`}
      onClick={(e) => e.stopPropagation()}>
      {user.name || user.email}
    </a>
  );
};

type AttendeeProps = {
  name?: string;
  email: string;
  phoneNumber: string | null;
  id: number;
  noShow: boolean;
};

type NoShowProps = {
  bookingUid: string;
  isBookingInPast: boolean;
};

const Attendee = (attendeeProps: AttendeeProps & NoShowProps) => {
  const { email, name, bookingUid, isBookingInPast, noShow: noShowAttendee, phoneNumber } = attendeeProps;
  const { t } = useLocale();

  // const [noShow, setNoShow] = useState(noShowAttendee);
  const [openDropdown, setOpenDropdown] = useState(false);
  const { copyToClipboard, isCopied } = useCopy();

  // const noShowMutation = trpc.viewer.markNoShow.useMutation({
  //   onSuccess: async (data) => {
  //     showToast(data.message, "success");
  //   },
  //   onError: (err) => {
  //     showToast(err.message, "error");
  //   },
  // });

  // function toggleNoShow({
  //   attendee,
  //   bookingUid,
  // }: {
  //   attendee: { email: string; noShow: boolean };
  //   bookingUid: string;
  // }) {
  //   noShowMutation.mutate({ bookingUid, attendees: [attendee] });
  //   setNoShow(!noShow);
  // }

  return (
    <Dropdown open={openDropdown} onOpenChange={setOpenDropdown}>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="guest"
          onClick={(e) => e.stopPropagation()}
          className="radix-state-open:text-blue-500 transition hover:text-blue-500">
          {noShowAttendee ? (
            <s>
              {name || email} <Icon name="eye-off" className="inline h-4" />
            </s>
          ) : (
            <>{name || email}</>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {!isSmsCalEmail(email) && (
          <DropdownMenuItem className="focus:outline-none">
            <DropdownItem
              StartIcon="mail"
              href={`mailto:${email}`}
              onClick={(e) => {
                setOpenDropdown(false);
                e.stopPropagation();
              }}>
              <a href={`mailto:${email}`}>{t("email")}</a>
            </DropdownItem>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem className="focus:outline-none">
          <DropdownItem
            StartIcon={isCopied ? "clipboard-check" : "clipboard"}
            onClick={(e) => {
              e.preventDefault();
              copyToClipboard(email);
              setOpenDropdown(false);
              showToast(t("email_copied"), "success");
            }}>
            {!isCopied ? t("copy") : t("copied")}
          </DropdownItem>
        </DropdownMenuItem>

        {phoneNumber && (
          <DropdownMenuItem className="focus:outline-none">
            <DropdownItem
              StartIcon={isCopied ? "clipboard-check" : "phone"}
              onClick={(e) => {
                e.preventDefault();
                copyToClipboard(phoneNumber);
                setOpenDropdown(false);
                showToast(t("phone_number_copied"), "success");
              }}>
              {!isCopied ? t("copy") : t("copied")}
            </DropdownItem>
          </DropdownMenuItem>
        )}
        {/* {isBookingInPast && (
          <DropdownMenuItem className="focus:outline-none">
            {noShow ? (
              <DropdownItem
                data-testid="unmark-no-show"
                onClick={(e) => {
                  e.preventDefault();
                  setOpenDropdown(false);
                  toggleNoShow({ attendee: { noShow: false, email }, bookingUid });
                }}
                StartIcon="eye">
                {t("unmark_as_no_show")}
              </DropdownItem>
            ) : (
              <DropdownItem
                data-testid="mark-no-show"
                onClick={(e) => {
                  e.preventDefault();
                  setOpenDropdown(false);
                  toggleNoShow({ attendee: { noShow: true, email }, bookingUid });
                }}
                StartIcon="eye-off">
                {t("mark_as_no_show")}
              </DropdownItem>
            )}
          </DropdownMenuItem>
        )} */}
      </DropdownMenuContent>
    </Dropdown>
  );
};

type GroupedAttendeeProps = {
  attendees: AttendeeProps[];
  bookingUid: string;
};

const GroupedAttendees = (groupedAttendeeProps: GroupedAttendeeProps) => {
  const attendees = groupedAttendeeProps.attendees.map((attendee) => {
    return {
      id: attendee.id,
      email: attendee.email,
      name: attendee.name,
      noShow: attendee.noShow || false,
    };
  });
  const { t } = useLocale();
  const [openDropdown, setOpenDropdown] = useState(false);
  const copyToClipboard = (e: React.MouseEvent<HTMLSpanElement>) => {
    const content = (e.target as HTMLSpanElement).innerText;

    navigator.clipboard
      .writeText(content)
      .then(() => {
        showToast(t("copied"), "success");
      })
      .catch(() => {
        showToast(t("failed_to_copy"), "error");
      })
      .finally(() => setOpenDropdown(false));
  };

  return (
    <Dropdown open={openDropdown} onOpenChange={setOpenDropdown}>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="more-guests"
          onClick={(e) => e.stopPropagation()}
          className="radix-state-open:text-blue-500 transition hover:text-blue-500 focus:outline-none">
          {t("plus_more", { count: attendees.length - 1 })}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <div className="flex flex-col gap-3 px-4 py-3">
          {attendees.slice(1).map((attendee) => {
            return (
              <div className={`hover:bg-slate-50 ${attendee.noShow && "line-through"}`} key={attendee.id}>
                <span onClick={copyToClipboard}>{attendee.name?.trim() || attendee.email} </span>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </Dropdown>
  );
};

const NoShowAttendeesDialog = ({
  attendees,
  isOpen,
  setIsOpen,
  bookingUid,
}: {
  attendees: AttendeeProps[];
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  bookingUid: string;
}) => {
  const { t } = useLocale();
  const [noShowAttendees, setNoShowAttendees] = useState(
    attendees.map((attendee) => ({
      id: attendee.id,
      email: attendee.email,
      name: attendee.name,
      noShow: attendee.noShow || false,
    }))
  );

  const noShowMutation = trpc.viewer.markNoShow.useMutation({
    onSuccess: async (data) => {
      const newValue = data.attendees[0];
      setNoShowAttendees((old) =>
        old.map((attendee) =>
          attendee.email === newValue.email ? { ...attendee, noShow: newValue.noShow } : attendee
        )
      );
      showToast(t(data.message), "success");
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={() => setIsOpen(false)}>
      <DialogContent title={t("mark_as_no_show_title")} description={t("no_show_description")}>
        {noShowAttendees.map((attendee) => (
          <form
            key={attendee.id}
            onSubmit={(e) => {
              e.preventDefault();
              noShowMutation.mutate({
                bookingUid,
                attendees: [{ email: attendee.email, noShow: !attendee.noShow }],
              });
            }}>
            <div className="bg-muted flex items-center justify-between rounded-md px-4 py-2">
              <span className="text-emphasis flex flex-col text-sm">
                {attendee.name}
                {attendee.email && <span className="text-muted">({attendee.email})</span>}
              </span>
              <Button color="minimal" type="submit" StartIcon={attendee.noShow ? "eye-off" : "eye"}>
                {attendee.noShow ? t("unmark_as_no_show") : t("mark_as_no_show")}
              </Button>
            </div>
          </form>
        ))}
        <DialogFooter>
          <DialogClose>{t("done")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const GroupedGuests = ({ guests }: { guests: AttendeeProps[] }) => {
  const [openDropdown, setOpenDropdown] = useState(false);
  const { t } = useLocale();
  const { copyToClipboard, isCopied } = useCopy();
  const [selectedEmail, setSelectedEmail] = useState("");

  return (
    <Dropdown
      open={openDropdown}
      onOpenChange={(value) => {
        setOpenDropdown(value);
        setSelectedEmail("");
      }}>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="radix-state-open:text-blue-500 transition hover:text-blue-500 focus:outline-none">
          {t("plus_more", { count: guests.length - 1 })}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="text-xs font-medium uppercase">{t("guests")}</DropdownMenuLabel>
        {guests.slice(1).map((guest) => (
          <DropdownMenuItem key={guest.id}>
            <DropdownItem
              className="pr-6 focus:outline-none"
              StartIcon={selectedEmail === guest.email ? "circle-check" : undefined}
              onClick={(e) => {
                e.preventDefault();
                setSelectedEmail(guest.email);
              }}>
              <span className={`${selectedEmail !== guest.email ? "pl-6" : ""}`}>{guest.email}</span>
            </DropdownItem>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="flex justify-end space-x-2 p-2 ">
          <Link href={`mailto:${selectedEmail}`}>
            <Button
              color="secondary"
              disabled={selectedEmail.length === 0}
              onClick={(e) => {
                setOpenDropdown(false);
                e.stopPropagation();
              }}>
              {t("email")}
            </Button>
          </Link>
          <Button
            color="secondary"
            disabled={selectedEmail.length === 0}
            onClick={(e) => {
              e.preventDefault();
              copyToClipboard(selectedEmail);
              showToast(t("email_copied"), "success");
            }}>
            {!isCopied ? t("copy") : t("copied")}
          </Button>
        </div>
      </DropdownMenuContent>
    </Dropdown>
  );
};

const DisplayAttendees = ({
  attendees,
  user,
  currentEmail,
  bookingUid,
  isBookingInPast,
}: {
  attendees: AttendeeProps[];
  user: UserProps | null;
  currentEmail?: string | null;
  bookingUid: string;
  isBookingInPast: boolean;
}) => {
  const { t } = useLocale();
  attendees.sort((a, b) => a.id - b.id);

  return (
    <div className="text-emphasis text-sm">
      {user && <FirstAttendee user={user} currentEmail={currentEmail} />}
      {attendees.length > 1 ? <span>,&nbsp;</span> : <span>&nbsp;{t("and")}&nbsp;</span>}
      <Attendee {...attendees[0]} bookingUid={bookingUid} isBookingInPast={isBookingInPast} />
      {attendees.length > 1 && (
        <>
          <div className="text-emphasis inline-block text-sm">&nbsp;{t("and")}&nbsp;</div>
          {attendees.length > 2 ? (
            <Tooltip
              content={attendees.slice(1).map((attendee) => (
                <p key={attendee.email}>
                  <Attendee {...attendee} bookingUid={bookingUid} isBookingInPast={isBookingInPast} />
                </p>
              ))}>
              {isBookingInPast ? (
                <GroupedAttendees attendees={attendees} bookingUid={bookingUid} />
              ) : (
                <GroupedGuests guests={attendees} />
              )}
            </Tooltip>
          ) : (
            <Attendee {...attendees[1]} bookingUid={bookingUid} isBookingInPast={isBookingInPast} />
          )}
        </>
      )}
    </div>
  );
};

const DisplayLocation = ({
  locationToDisplay,
  provider,
  className,
}: {
  locationToDisplay: string;
  provider: DefaultEventLocationType | EventLocationTypeFromApp | null | undefined;
  className?: string;
}) => {
  const { t } = useLocale();

  return !locationToDisplay ? (
    <></>
  ) : locationToDisplay.startsWith("http") ? (
    <a
      href={locationToDisplay}
      target="_blank"
      title={locationToDisplay}
      className="text-sm leading-6 text-blue-600 hover:underline dark:text-blue-400"
      rel="noreferrer">
      <div className="flex gap-1">
        {" "}
        {provider?.iconUrl ? (
          <div className="relative h-6 w-6">
            <Image
              src={provider.iconUrl}
              alt={`${provider?.label} logo`}
              className="rounded-sm object-contain"
              fill
            />
          </div>
        ) : (
          <Icon name="external-link" className="text-default inline h-4 w-4" />
        )}
        {provider?.label
          ? t("join_event_location", { eventLocationType: provider?.label })
          : t("join_meeting")}
      </div>
    </a>
  ) : (
    <div className="flex gap-1">
      <Icon
        name={locationToDisplay.startsWith("+") ? "phone-call" : "map-pin"}
        className="text-default mt-1 inline h-4 w-4"
      />

      <p className={classNames("text-sm leading-6", className)}>{locationToDisplay}</p>
    </div>
  );
};

const AssignmentReasonTooltip = ({ assignmentReason }: { assignmentReason: AssignmentReason }) => {
  const { t } = useLocale();
  const badgeTitle = assignmentReasonBadgeTitleMap(assignmentReason.reasonEnum);
  return (
    <Tooltip content={<p>{assignmentReason.reasonString}</p>}>
      <div className="-mt-1">
        <Badge className="ltr:mr-2 rtl:ml-2" variant="gray">
          {t(badgeTitle)}
        </Badge>
      </div>
    </Tooltip>
  );
};

export default BookingListItem;
