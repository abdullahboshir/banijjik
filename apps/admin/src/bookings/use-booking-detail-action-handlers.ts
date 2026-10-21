"use client";

import type { BookingResponse } from "@banijjik/contracts/booking";
import { useRouter } from "next/navigation";
import { useState, type Dispatch, type SetStateAction } from "react";
import { cancelBooking, transitionBooking } from "./booking-api";
import { bookingTransitionActions } from "./booking-detail-action-items";

export function useBookingDetailActionHandlers(input: {
  organizationId: string;
  booking: BookingResponse;
  canUpdate: boolean;
  labels: {
    confirm: string;
    checkIn: string;
    complete: string;
    noShow: string;
    cancel: string;
    cancelReason: string;
  };
}): {
  isSaving: boolean;
  cancelReason: string;
  setCancelReason: Dispatch<SetStateAction<string>>;
  actions: readonly { key: string; label: string; run: () => void }[];
  handleCancel: () => Promise<void>;
} {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  async function runTransition(action: string, body: Record<string, unknown>): Promise<void> {
    setIsSaving(true);
    try {
      await transitionBooking({
        organizationId: input.organizationId,
        bookingId: input.booking.bookingId,
        action,
        body,
      });
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCancel(): Promise<void> {
    if (cancelReason.trim() === "") return;
    setIsSaving(true);
    try {
      await cancelBooking(input.organizationId, input.booking.bookingId, {
        version: input.booking.version,
        reason: cancelReason.trim(),
      });
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  const actions = bookingTransitionActions({
    booking: input.booking,
    canUpdate: input.canUpdate,
    labels: input.labels,
  }).map((item) => ({
    key: item.key,
    label: item.label,
    run: () => void runTransition(item.action, item.body),
  }));

  return { isSaving, cancelReason, setCancelReason, actions, handleCancel };
}
