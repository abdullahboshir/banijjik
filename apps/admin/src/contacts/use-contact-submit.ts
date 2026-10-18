"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { useRef, useState } from "react";
import type { CustomFieldsFormState } from "../custom-fields/use-custom-fields-form";
import { keyForSubmit, type KeyedSubmit } from "../invitations/idempotency-keeper";
import { ApiError } from "../lib/api/api-error";
import {
  useSheetSubmit,
  type SheetSendResult,
  type SheetSubmitState,
} from "../settings/use-sheet-submit";
import { createContact, updateContact } from "./contact-api";
import {
  buildContactCreate,
  buildContactUpdate,
  contactInputErrors,
  CONTACT_FORM_NAMES,
  type ContactFormInitial,
  type ContactFormState,
} from "./contact-form";

const DUPLICATE_KEY = "errors.contact_duplicate";

/** The contact that already has the phone, from the 409 the API answers (ADR-110). */
export interface Duplicate {
  contactId: string;
}

function duplicateOf(error: ApiError): Duplicate | undefined {
  if (error.code !== ERROR_CODE.CONFLICT || error.messageKey !== DUPLICATE_KEY) return undefined;
  const contactId: unknown = error.details?.["contactId"];
  return typeof contactId === "string" ? { contactId } : undefined;
}

export interface ContactSubmitInput {
  sheet: {
    organizationId: string;
    contact?: ContactFormInitial | undefined;
    onClose: () => void;
  };
  form: ContactFormState;
  fieldsForm: CustomFieldsFormState;
}

/**
 * The submit cycle of the contact sheet: the inputs and the details are checked together, a create carries
 * an Idempotency-Key so a retry never adds the person twice, and a phone that already belongs to a contact
 * is kept apart from other refusals so the sheet can offer "open existing".
 */
export function useContactSubmit(input: ContactSubmitInput): {
  state: SheetSubmitState;
  duplicate: Duplicate | undefined;
} {
  const { sheet, form, fieldsForm } = input;
  const [duplicate, setDuplicate] = useState<Duplicate | undefined>(undefined);
  const lastSubmit = useRef<KeyedSubmit | undefined>(undefined);

  async function sendContact(customFields: Record<string, unknown>): Promise<SheetSendResult> {
    const { organizationId, contact } = sheet;
    if (contact) {
      const update = buildContactUpdate(form, contact, customFields);
      if (!update.ok) return update;
      if (update.body !== undefined) {
        await updateContact(organizationId, contact.contactId, update.body);
      }
      return { ok: true };
    }
    const create = buildContactCreate(form, customFields);
    if (!create.ok) return create;
    lastSubmit.current = keyForSubmit(lastSubmit.current, JSON.stringify(create.body), newId);
    await createContact(organizationId, create.body, lastSubmit.current.key);
    lastSubmit.current = undefined;
    return { ok: true };
  }

  async function send(): Promise<SheetSendResult> {
    setDuplicate(undefined);
    const details = fieldsForm.buildRequest();
    // The details show their own errors; the other inputs are checked here so both appear at once.
    if (!details.ok) return { ok: false, fieldErrors: contactInputErrors(form) };
    try {
      return await sendContact(details.customFields);
    } catch (error) {
      const existing = error instanceof ApiError ? duplicateOf(error) : undefined;
      if (existing === undefined) throw error;
      setDuplicate(existing);
      return { ok: false, fieldErrors: {} };
    }
  }

  const state = useSheetSubmit({ fieldNames: CONTACT_FORM_NAMES, onClose: sheet.onClose, send });
  return { state, duplicate };
}
