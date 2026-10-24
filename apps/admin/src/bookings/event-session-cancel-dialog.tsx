"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { ConfirmDialog } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { cancelEventSession, type EventSessionView } from "./event-session-api";

export interface EventSessionCancelDialogProps {
  organizationId: string;
  session: EventSessionView;
  onClose: () => void;
}

/**
 * Asks before cancelling and says how many seats are sold. The cancel job settles those bookings a
 * little later (card 3.6b A3), so the text promises neither an instant effect nor a refund.
 */
export function EventSessionCancelDialog(props: EventSessionCancelDialogProps): ReactElement {
  const { t } = useTranslator();
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | undefined>();
  const { session } = props;

  async function run(): Promise<void> {
    try {
      await cancelEventSession(props.organizationId, session.eventSessionId, session.version);
      props.onClose();
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const isConflict = error.code === ERROR_CODE.CONFLICT;
      setRefusal(
        isConflict ? t("bookings.form.conflict") : t(knownMessageKeyOrInternal(error.messageKey)),
      );
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => (open ? undefined : props.onClose())}
      title={t("bookings.eventSessions.cancelTitle")}
      description={
        refusal ??
        t("bookings.eventSessions.cancelDescription", {
          sold: session.seatsSold,
          capacity: session.capacity,
        })
      }
      confirmLabel={t("bookings.eventSessions.cancelConfirm")}
      cancelLabel={t("bookings.eventSessions.cancelKeep")}
      closeLabel={t("bookings.form.close")}
      tone="danger"
      onConfirm={() => void run()}
    />
  );
}
