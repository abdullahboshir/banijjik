"use client";

import type { BookingResponse } from "@banijjik/contracts/booking";
import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";
import { canShowCancelPanel } from "./booking-detail-action-items";
import { BookingDetailCancelPanel } from "./booking-detail-cancel-panel";
import { useBookingDetailActionHandlers } from "./use-booking-detail-action-handlers";

export interface BookingDetailActionsProps {
  organizationId: string;
  booking: BookingResponse;
  labels: {
    confirm: string;
    checkIn: string;
    complete: string;
    noShow: string;
    cancel: string;
    cancelReason: string;
  };
  permissions: {
    canUpdate: boolean;
    canCancel: boolean;
  };
}

export function BookingDetailActions(props: BookingDetailActionsProps): ReactElement | null {
  const { booking, labels } = props;
  const handlers = useBookingDetailActionHandlers({
    organizationId: props.organizationId,
    booking,
    canUpdate: props.permissions.canUpdate,
    labels,
  });

  if (handlers.actions.length === 0 && !props.permissions.canCancel) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {handlers.actions.map((action) => (
          <Button key={action.key} type="button" isLoading={handlers.isSaving} onClick={action.run}>
            {action.label}
          </Button>
        ))}
      </div>
      {canShowCancelPanel({ canCancel: props.permissions.canCancel, status: booking.status }) ? (
        <BookingDetailCancelPanel
          cancelReason={handlers.cancelReason}
          cancelReasonLabel={labels.cancelReason}
          cancelLabel={labels.cancel}
          isSaving={handlers.isSaving}
          onReasonChange={handlers.setCancelReason}
          onCancel={() => void handlers.handleCancel()}
        />
      ) : null}
    </div>
  );
}
