"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import { FULFILLMENT_METHOD } from "@banijjik/contracts/sales";
import { newId } from "@banijjik/ids";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  completeInstantOrder,
  placeNewOrder,
  saveNewDraft,
  type CreatedOrder,
  type NewOrderValues,
  type SubmitContext,
} from "./new-order-submit";
import type { NewOrderWorkspaceProps } from "./new-order-workspace";
import { useOrderApprovalFlow, type OrderApprovalFlow } from "./order-approval";
import { resolveContactId } from "./order-contact";
import { messageOf } from "./order-failure";
import {
  emptyOrderLine,
  lineInputsOfDrafts,
  parseLineDraft,
  parseManualDiscount,
} from "./order-lines";

export interface NewOrderForm {
  readonly values: NewOrderValues;
  readonly createdOrder: CreatedOrder | undefined;
  readonly isSaving: boolean;
  readonly errorMessage: string | undefined;
  readonly approval: OrderApprovalFlow;
  readonly lineInputs: ReturnType<typeof lineInputsOfDrafts>;
  readonly orderDiscount: ReturnType<typeof parseManualDiscount>;
  readonly discountInvalid: boolean;
  readonly isInstant: boolean;
  readonly contactNames: Map<string, string>;
  readonly currency: CurrencyCode;
  readonly setValues: (changes: Partial<NewOrderValues>) => void;
  readonly openOrder: (orderId: string) => void;
  readonly saveDraft: () => Promise<void>;
  readonly place: () => Promise<void>;
  readonly completeInstant: () => Promise<void>;
}

interface ValidationInput {
  readonly props: NewOrderWorkspaceProps;
  readonly values: NewOrderValues;
  readonly discountInvalid: boolean;
  readonly lineInputsCount: number;
  readonly needsLines: boolean;
}

function validationMessageOf(input: ValidationInput): string | undefined {
  const { labels } = input.props;
  if (input.values.locationId === "") return labels.newOrder.locationRequired;
  if (input.discountInvalid) return labels.line.discountInvalid;
  if (input.values.lines.some((line) => parseLineDraft(line).kind === "invalid")) {
    return labels.newOrder.invalidLine;
  }
  if (input.needsLines && input.lineInputsCount === 0) return labels.newOrder.noLinesToPlace;
  return undefined;
}

interface SubmitHookInput {
  readonly props: NewOrderWorkspaceProps;
  readonly values: NewOrderValues;
  readonly createdOrder: CreatedOrder | undefined;
  readonly discountInvalid: boolean;
  readonly lineInputs: ReturnType<typeof lineInputsOfDrafts>;
  readonly orderDiscount: ReturnType<typeof parseManualDiscount>;
  readonly approval: OrderApprovalFlow;
  readonly rememberDraft: (draft: CreatedOrder) => void;
  readonly openOrder: (orderId: string) => void;
  readonly setErrorMessage: (message: string | undefined) => void;
}

/** Validates, resolves the contact, then runs one of the submit flows with the saving state around it. */
function useSubmit(input: SubmitHookInput): {
  readonly isSaving: boolean;
  readonly submit: (
    needsLines: boolean,
    flow: (context: SubmitContext) => Promise<void>,
  ) => Promise<void>;
} {
  const { t } = useTranslator();
  const { props, values, setErrorMessage } = input;
  const [isSaving, setIsSaving] = useState(false);
  const contactKey = useRef(newId());

  async function submit(
    needsLines: boolean,
    flow: (context: SubmitContext) => Promise<void>,
  ): Promise<void> {
    const message = validationMessageOf({
      props,
      values,
      discountInvalid: input.discountInvalid,
      lineInputsCount: input.lineInputs.length,
      needsLines,
    });
    if (message !== undefined) {
      setErrorMessage(message);
      return;
    }
    setIsSaving(true);
    setErrorMessage(undefined);
    try {
      const contactId = await resolveContactId({
        organizationId: props.organizationId,
        contact: values.contact,
        idempotencyKey: contactKey.current,
        phoneInvalidMessage: props.labels.contact.phoneInvalid,
      });
      await flow({
        organizationId: props.organizationId,
        currency: props.currency,
        labels: props.labels,
        values,
        lineInputs: input.lineInputs,
        orderDiscount: input.orderDiscount,
        contactId: contactId ?? undefined,
        createdOrder: input.createdOrder,
        approval: input.approval,
        rememberDraft: input.rememberDraft,
        openOrder: input.openOrder,
      });
    } catch (error) {
      setErrorMessage(messageOf(error, t));
    } finally {
      setIsSaving(false);
    }
  }

  return { isSaving, submit };
}

export function useNewOrderForm(props: NewOrderWorkspaceProps): NewOrderForm {
  const { t } = useTranslator();
  const router = useRouter();
  const [values, setAllValues] = useState<NewOrderValues>(() => ({
    locationId: props.locations[0]?.locationId ?? "",
    fulfillment: FULFILLMENT_METHOD.PICKUP,
    contact: null,
    lines: [emptyOrderLine(newId())],
    discountType: "NONE",
    discountText: "",
    note: "",
  }));
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const contactNames = useRef(new Map<string, string>());
  const approval = useOrderApprovalFlow({
    organizationId: props.organizationId,
    labels: props.labels.approval,
    onFailure: (error) => setErrorMessage(messageOf(error, t)),
  });

  const orderDiscount = parseManualDiscount(values.discountType, values.discountText);
  const discountInvalid = values.discountType !== "NONE" && orderDiscount === undefined;
  const lineInputs = lineInputsOfDrafts(values.lines);

  function openOrder(orderId: string): void {
    router.push(`/${props.orgSlug}/orders/${orderId}`);
    router.refresh();
  }

  const { isSaving, submit } = useSubmit({
    props,
    values,
    createdOrder,
    discountInvalid,
    lineInputs,
    orderDiscount,
    approval,
    rememberDraft: setCreatedOrder,
    openOrder,
    setErrorMessage,
  });

  return {
    values,
    createdOrder,
    isSaving,
    errorMessage,
    approval,
    lineInputs,
    orderDiscount,
    discountInvalid,
    isInstant: values.fulfillment === FULFILLMENT_METHOD.INSTANT,
    contactNames: contactNames.current,
    currency: props.currency,
    setValues: (changes) => setAllValues((current) => ({ ...current, ...changes })),
    openOrder,
    saveDraft: () => submit(false, saveNewDraft),
    place: () => submit(true, placeNewOrder),
    completeInstant: () => submit(true, completeInstantOrder),
  };
}
