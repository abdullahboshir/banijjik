"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { ConfirmDialog } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { ScreenTextProvider, useScreenText, type ScreenTexts } from "./screen-text";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { cancelEventSession, type EventSessionView } from "./event-session-api";

export interface EventSessionCancelDialogProps {
  organizationId: string;
  session: EventSessionView;
  texts: ScreenTexts;
  onClose: () => void;
}

/**
 * Asks before cancelling and says how many seats are sold. The cancel job settles those bookings a
 * little later (card 3.6b A3), so the text promises neither an instant effect nor a refund.
 */
function EventSessionCancelDialogInner(props: EventSessionCancelDialogProps): ReactElement {
  const text = useScreenText();
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
        isConflict
          ? text("bookings.form.conflict")
          : t(knownMessageKeyOrInternal(error.messageKey)),
      );
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => (open ? undefined : props.onClose())}
      title={text("bookings.eventSessions.cancelTitle")}
      description={
        refusal ??
        text("bookings.eventSessions.cancelDescription", {
          sold: session.seatsSold,
          capacity: session.capacity,
        })
      }
      confirmLabel={text("bookings.eventSessions.cancelConfirm")}
      cancelLabel={text("bookings.eventSessions.cancelKeep")}
      closeLabel={text("bookings.form.close")}
      tone="danger"
      onConfirm={() => void run()}
    />
  );
}

export function EventSessionCancelDialog(props: EventSessionCancelDialogProps): ReactElement {
  return (
    <ScreenTextProvider texts={props.texts}>
      <EventSessionCancelDialogInner {...props} />
    </ScreenTextProvider>
  );
}
