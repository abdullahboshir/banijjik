"use client";

import { newId } from "@banijjik/ids";
import type { ContactLinkInputProps, ContactLinkValue } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import type { KeyedSubmit } from "../invitations/idempotency-keeper";
import { ApiError } from "../lib/api/api-error";
import {
  contactLinkLabelsOf,
  resolveContactId,
  searchContactCandidates,
} from "./contact-link-support";
import { recordCheckIn } from "./enrollment-api";

export type CheckInOutcome =
  { kind: "none" } | { kind: "done" } | { kind: "failed"; messageKey: string };

export interface CheckInModel {
  readonly contact: ContactLinkValue | null;
  readonly setContact: (contact: ContactLinkValue | null) => void;
  readonly isSaving: boolean;
  readonly outcome: CheckInOutcome;
  readonly link: Pick<ContactLinkInputProps, "search" | "labels">;
  readonly submit: () => Promise<void>;
}

/** One tap: the person is found (or added), then the API picks their active enrollment (decision 8). */
export function useCheckIn(input: { organizationId: string; locationId: string }): CheckInModel {
  const { t } = useTranslator();
  const router = useRouter();
  const [contact, setContact] = useState<ContactLinkValue | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [outcome, setOutcome] = useState<CheckInOutcome>({ kind: "none" });
  const lastCreate = useRef<KeyedSubmit | undefined>(undefined);
  const link = useMemo(
    () => ({
      search: searchContactCandidates(input.organizationId),
      labels: contactLinkLabelsOf(t),
    }),
    [input.organizationId, t],
  );

  async function submit(): Promise<void> {
    if (contact === null) return;
    setIsSaving(true);
    setOutcome({ kind: "none" });
    try {
      const contactId = await resolveContactId({
        organizationId: input.organizationId,
        contact,
        lastCreate,
      });
      await recordCheckIn(
        input.organizationId,
        { locationId: input.locationId, contactId },
        newId(),
      );
      setContact(null);
      setOutcome({ kind: "done" });
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      setOutcome({ kind: "failed", messageKey: knownMessageKeyOrInternal(error.messageKey) });
    } finally {
      setIsSaving(false);
    }
  }

  return { contact, setContact, isSaving, outcome, link, submit };
}
