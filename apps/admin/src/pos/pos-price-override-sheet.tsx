"use client";

import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import type { Money } from "@banijjik/contracts/payment";
import { INSTANT_ORDER_APPROVAL_SUBJECT } from "@banijjik/contracts/sales";
import type { QuoteRequest } from "@banijjik/contracts/pricing";
import { Sheet, SheetContent, type DisplayLocale } from "@banijjik/ui";
import { moneyFromInput, moneyToInputText } from "@banijjik/web-client";
import { useEffect, useState, type ReactElement } from "react";
import { grantApproval, listApprovers } from "../payments/payment-api";
import { useApprovalDialogState } from "../payments/use-approval-dialog-state";
import {
  OverrideApproval,
  OverridePriceFields,
  type QuoteTotals,
} from "./pos-price-override-fields";
import type { CartLine } from "./cart";
import type { PosLabels } from "./pos-labels";
import { quoteCart } from "./pos-api";

function quoteBody(locationId: string, lines: readonly CartLine[]): QuoteRequest {
  return {
    locationId,
    lines: lines.map((line) => ({
      offeringId: line.offeringId,
      variantId: line.variantId,
      quantity: line.quantity,
      modifierOptionIds: [],
      ...(line.unitPriceOverride === null ? {} : { unitPriceOverride: line.unitPriceOverride }),
    })),
  };
}

function linesWithDraft(lines: readonly CartLine[], lineKey: string, price: Money | null) {
  return lines.map((line) =>
    line.lineKey === lineKey ? { ...line, unitPriceOverride: price } : line,
  );
}

function useDraftQuotes(input: {
  readonly organizationId: string;
  readonly locationId: string;
  readonly lines: readonly CartLine[];
  readonly lineKey: string;
  readonly price: Money | undefined;
}): QuoteTotals {
  const [totals, setTotals] = useState<QuoteTotals>({ list: null, override: null, failed: false });
  const priceAmount = input.price?.amount ?? null;
  const priceCurrency = input.price?.currency ?? null;
  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      if (priceAmount === null || priceCurrency === null) return;
      const draftPrice: Money = { amount: priceAmount, currency: priceCurrency };
      const original = linesWithDraft(input.lines, input.lineKey, null);
      const overridden = linesWithDraft(input.lines, input.lineKey, draftPrice);
      try {
        const [listQuote, overrideQuote] = await Promise.all([
          quoteCart(input.organizationId, quoteBody(input.locationId, original)),
          quoteCart(input.organizationId, quoteBody(input.locationId, overridden)),
        ]);
        if (!cancelled) {
          setTotals({
            list: listQuote.totals.grandTotal.amount,
            override: overrideQuote.totals.grandTotal.amount,
            failed: false,
          });
        }
      } catch {
        if (!cancelled) setTotals({ list: null, override: null, failed: true });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    input.organizationId,
    input.locationId,
    input.lines,
    input.lineKey,
    priceAmount,
    priceCurrency,
  ]);
  return totals;
}

export interface PosPriceOverrideSheetProps {
  readonly organizationId: string;
  readonly locationId: string;
  readonly currency: Money["currency"];
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly line: CartLine;
  readonly listPrice: Money;
  readonly lines: readonly CartLine[];
  readonly onApply: (lineKey: string, price: Money | null, token: string | null) => void;
  readonly onClose: () => void;
}

function approvalAmountMinorOf(
  lines: readonly CartLine[],
  lineKey: string,
  price: Money | undefined,
): number {
  if (price === undefined) return 0;
  return lines.reduce((total, line) => {
    const linePrice = line.lineKey === lineKey ? price : line.unitPriceOverride;
    if (linePrice === null || linePrice.amount >= line.listPrice.amount) return total;
    return total + (line.listPrice.amount - linePrice.amount) * line.quantity;
  }, 0);
}

function usePriceOverrideActions(input: {
  readonly props: PosPriceOverrideSheetProps;
  readonly price: Money | undefined;
  readonly approvalAmountMinor: number;
  readonly approval: ReturnType<typeof useApprovalDialogState>;
}) {
  const [error, setError] = useState<string | undefined>();

  async function beginApply(): Promise<void> {
    if (input.price === undefined) return;
    setError(undefined);
    if (input.approvalAmountMinor <= 0) {
      input.props.onApply(
        input.props.line.lineKey,
        sameMoney(input.price, input.props.listPrice) ? null : input.price,
        null,
      );
      return;
    }
    try {
      const choices = await listApprovers(input.props.organizationId, input.props.locationId);
      if (choices.length === 0) {
        setError(input.props.labels.till.noApprovers);
        return;
      }
      input.approval.openApproval(choices);
    } catch {
      setError(input.props.labels.till.approvalFailed);
    }
  }

  async function grant(pinInput: { approverMemberId: string; pin: string }): Promise<void> {
    if (input.price === undefined) return;
    input.approval.setIsApproving(true);
    input.approval.setApprovalError(undefined);
    try {
      const result = await grantApproval(input.props.organizationId, {
        action: APPROVAL_ACTION.PRICE_OVERRIDE,
        subjectKey: INSTANT_ORDER_APPROVAL_SUBJECT,
        amount: { amount: input.approvalAmountMinor, currency: input.props.currency },
        locationId: input.props.locationId,
        approverMemberId: pinInput.approverMemberId,
        pin: pinInput.pin,
      });
      input.props.onApply(
        input.props.line.lineKey,
        sameMoney(input.price, input.props.listPrice) ? null : input.price,
        result.approvalToken,
      );
      input.approval.closeApproval();
    } catch (caught) {
      input.approval.handlePinError(caught, input.props.labels.till.approvalFailed);
    } finally {
      input.approval.setIsApproving(false);
    }
  }

  return { error, beginApply, grant };
}

/** A server-quoted line override, with a PIN grant only when the cart has a below-list price. */
export function PosPriceOverrideSheet(props: PosPriceOverrideSheetProps): ReactElement {
  const [priceText, setPriceText] = useState(
    props.line.unitPriceOverride === null
      ? moneyToInputText(props.listPrice)
      : moneyToInputText(props.line.unitPriceOverride),
  );
  const approval = useApprovalDialogState();
  const price = moneyFromInput(priceText, props.currency) ?? undefined;
  const totals = useDraftQuotes({
    organizationId: props.organizationId,
    locationId: props.locationId,
    lines: props.lines,
    lineKey: props.line.lineKey,
    price,
  });
  const approvalAmountMinor = approvalAmountMinorOf(props.lines, props.line.lineKey, price);
  const actions = usePriceOverrideActions({ props, price, approvalAmountMinor, approval });

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={props.labels.till.price} closeLabel={props.labels.till.approvalClose}>
        <div className="flex flex-col gap-4">
          <OverridePriceFields
            line={props.line}
            listPrice={props.listPrice}
            locale={props.locale}
            labels={props.labels}
            priceText={priceText}
            onPriceTextChange={setPriceText}
            totals={totals}
            currency={props.currency}
            error={actions.error}
            priceAvailable={price !== undefined}
            onCancel={props.onClose}
            onApply={() => void actions.beginApply()}
          />
          <OverrideApproval
            labels={props.labels}
            approval={approval}
            onSubmit={(input) => void actions.grant(input)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function sameMoney(left: Money | undefined, right: Money): boolean {
  return left !== undefined && left.amount === right.amount && left.currency === right.currency;
}
