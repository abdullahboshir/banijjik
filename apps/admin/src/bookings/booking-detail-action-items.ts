import type { BookingResponse } from "@banijjik/contracts/booking";
import { BOOKING_STATUS } from "@banijjik/contracts/booking";

export interface BookingTransitionActionItem {
  key: string;
  label: string;
  action: string;
  body: Record<string, unknown>;
}

export function bookingTransitionActions(input: {
  booking: BookingResponse;
  canUpdate: boolean;
  labels: {
    confirm: string;
    checkIn: string;
    complete: string;
    noShow: string;
  };
}): BookingTransitionActionItem[] {
  if (!input.canUpdate) return [];
  const { booking, labels } = input;
  const versionBody = { version: booking.version };
  const items: BookingTransitionActionItem[] = [];
  if (booking.status === BOOKING_STATUS.REQUESTED) {
    items.push({ key: "confirm", label: labels.confirm, action: "confirm", body: versionBody });
  }
  if (booking.status === BOOKING_STATUS.CONFIRMED) {
    items.push({ key: "check-in", label: labels.checkIn, action: "check-in", body: versionBody });
    items.push({ key: "no-show", label: labels.noShow, action: "no-show", body: versionBody });
  }
  if (booking.status === BOOKING_STATUS.CHECKED_IN) {
    items.push({ key: "complete", label: labels.complete, action: "complete", body: versionBody });
  }
  return items;
}

export function canShowCancelPanel(input: {
  canCancel: boolean;
  status: BookingResponse["status"];
}): boolean {
  if (!input.canCancel) return false;
  return input.status === BOOKING_STATUS.REQUESTED || input.status === BOOKING_STATUS.CONFIRMED;
}
