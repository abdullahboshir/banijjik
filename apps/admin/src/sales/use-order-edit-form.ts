"use client";

import { newId } from "@banijjik/ids";
import { toast } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useEffect, useRef, useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { useOrderApprovalFlow, type OrderApprovalFlow } from "./order-approval";
import { resolveContactId } from "./order-contact";
import { useEditDrafts, type EditDrafts } from "./order-edit-drafts";
import { NO_EDIT_ERRORS, type EditErrors, type EditValues } from "./order-edit-model";
import { saveOrderEdit } from "./order-edit-save";
import type { OrderEditSheetProps } from "./order-edit-sheet";
import { messageOf } from "./order-failure";
import {
  discountToText,
  lineInputsOfDrafts,
  parseLineDraft,
  parseManualDiscount,
  type OrderLineDraft,
} from "./order-lines";

const TOTAL_BELOW_PAID_KEY = "errors.order_total_below_paid";
const CONTACT_LOCKED_KEY = "errors.order_contact_locked_by_payment";

export interface OrderEditForm {
  readonly drafts: EditDrafts;
  readonly lines: readonly OrderLineDraft[];
  readonly values: EditValues;
  readonly errors: EditErrors;
  readonly isSaving: boolean;
  readonly approval: OrderApprovalFlow;
  readonly lineInputs: ReturnType<typeof lineInputsOfDrafts>;
  readonly nextDiscount: ReturnType<typeof parseManualDiscount>;
  readonly discountInvalid: boolean;
  readonly contactNames: Map<string, string>;
  readonly setLines: (lines: readonly OrderLineDraft[]) => void;
  readonly setValues: (changes: Partial<EditValues>) => void;
  readonly save: () => Promise<void>;
}

function initialValues(props: OrderEditSheetProps): EditValues {
  const discount = discountToText(props.order.orderDiscount);
  return {
    contact: props.order.contactId,
    discountType: discount.type,
    discountText: discount.text,
    note: props.order.note ?? "",
  };
}

/** Which message a failed save shows, and where: next to the totals, the contact or in general. */
function errorsOf(error: unknown, t: (key: string) => string): EditErrors {
  const messageKey = error instanceof ApiError ? error.messageKey : undefined;
  if (messageKey === TOTAL_BELOW_PAID_KEY) {
    return { ...NO_EDIT_ERRORS, totals: t(knownMessageKeyOrInternal(messageKey)) };
  }
  if (messageKey === CONTACT_LOCKED_KEY) {
    return { ...NO_EDIT_ERRORS, contact: t(knownMessageKeyOrInternal(messageKey)) };
  }
  return { ...NO_EDIT_ERRORS, message: messageOf(error, t) };
}

interface EditSaveContext {
  readonly props: OrderEditSheetProps;
  readonly values: EditValues;
  readonly lines: readonly OrderLineDraft[];
  readonly lineInputs: ReturnType<typeof lineInputsOfDrafts>;
  readonly nextDiscount: ReturnType<typeof parseManualDiscount>;
  readonly discountInvalid: boolean;
  readonly approval: OrderApprovalFlow;
  readonly setErrors: (errors: EditErrors) => void;
}

function invalidMessageOf(context: EditSaveContext): string | undefined {
  const { labels } = context.props;
  if (context.discountInvalid) return labels.line.discountInvalid;
  if (context.lines.length === 0) return labels.edit.noLines;
  const hasInvalidLine = context.lines.some((line) => parseLineDraft(line).kind === "invalid");
  const hasUnparsedLine = context.lineInputs.length !== context.lines.length;
  return hasInvalidLine || hasUnparsedLine ? labels.newOrder.invalidLine : undefined;
}

function useEditSave(context: EditSaveContext): {
  readonly isSaving: boolean;
  readonly save: () => Promise<void>;
} {
  const { t } = useTranslator();
  const { props, setErrors } = context;
  const [isSaving, setIsSaving] = useState(false);
  const contactKey = useRef(newId());

  async function save(): Promise<void> {
    const message = invalidMessageOf(context);
    if (message !== undefined) {
      setErrors({ ...NO_EDIT_ERRORS, message });
      return;
    }
    setIsSaving(true);
    setErrors(NO_EDIT_ERRORS);
    try {
      const contactId = await resolveContactId({
        organizationId: props.organizationId,
        contact: context.values.contact,
        idempotencyKey: contactKey.current,
        phoneInvalidMessage: props.labels.contact.phoneInvalid,
      });
      await saveOrderEdit({
        organizationId: props.organizationId,
        order: props.order,
        currency: props.currency,
        values: context.values,
        lineInputs: context.lineInputs,
        nextDiscount: context.nextDiscount,
        contactId,
        approval: context.approval,
        onSaved: () => {
          toast.success(props.labels.edit.success);
          props.onOpenChange(false);
          props.onSaved();
        },
      });
    } catch (error) {
      setErrors(errorsOf(error, t));
    } finally {
      setIsSaving(false);
    }
  }

  return { isSaving, save };
}

export function useOrderEditForm(props: OrderEditSheetProps): OrderEditForm {
  const { t } = useTranslator();
  const { labels, order } = props;
  const drafts = useEditDrafts(props.open, props.organizationId, order);
  const [lines, setLines] = useState<readonly OrderLineDraft[]>([]);
  const [values, setAllValues] = useState<EditValues>(() => initialValues(props));
  const [errors, setErrors] = useState<EditErrors>(NO_EDIT_ERRORS);
  const contactNames = useRef(new Map<string, string>());
  const wasOpen = useRef(false);
  const approval = useOrderApprovalFlow({
    organizationId: props.organizationId,
    labels: labels.approval,
    onFailure: (error) => setErrors(errorsOf(error, t)),
  });

  useEffect(() => setLines(drafts.lines), [drafts.lines]);
  useEffect(() => {
    if (props.open && !wasOpen.current) {
      setAllValues(initialValues(props));
      setErrors(NO_EDIT_ERRORS);
    }
    wasOpen.current = props.open;
  }, [props]);

  const nextDiscount = parseManualDiscount(values.discountType, values.discountText);
  const discountInvalid = values.discountType !== "NONE" && nextDiscount === undefined;
  const lineInputs = lineInputsOfDrafts(lines);

  const { isSaving, save } = useEditSave({
    props,
    values,
    lines,
    lineInputs,
    nextDiscount,
    discountInvalid,
    approval,
    setErrors,
  });

  return {
    drafts,
    lines,
    values,
    errors,
    isSaving,
    approval,
    lineInputs,
    nextDiscount,
    discountInvalid,
    contactNames: contactNames.current,
    setLines,
    setValues: (changes) => setAllValues((current) => ({ ...current, ...changes })),
    save,
  };
}
