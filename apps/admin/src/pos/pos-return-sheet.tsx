"use client";

import {
  ORDER_STATUS,
  SALES_RETURN_REASON,
  type OrderResponse,
  type SalesReturnReason,
  type SalesReturnResponse,
} from "@banijjik/contracts/sales";
import { Sheet, SheetContent, type DisplayLocale } from "@banijjik/ui";
import { useState, type ReactElement, useRef } from "react";
import {
  pickedLinesOf,
  ReturnResult,
  ReturnSearchPanel,
  SelectedReturnPanel,
} from "./pos-return-components";
import { getOrder, listOrders } from "../sales/order-api";
import { attemptFor, type CheckoutAttempt } from "./attempt-key";
import type { PosLabels } from "./pos-labels";
import { createTillReturn } from "./pos-api";

export interface PosReturnSheetProps {
  readonly organizationId: string;
  readonly locationId: string;
  readonly posSessionId: string;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly onClose: () => void;
}

function useReturnActions(input: {
  readonly props: PosReturnSheetProps;
  readonly query: string;
  readonly selected: OrderResponse | null;
  readonly quantities: Readonly<Record<string, number>>;
  readonly reason: SalesReturnReason;
  readonly note: string;
}) {
  const [orders, setOrders] = useState<readonly OrderResponse[]>([]);
  const [failure, setFailure] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SalesReturnResponse | null>(null);
  const attemptRef = useRef<CheckoutAttempt | null>(null);

  async function findOrders(): Promise<void> {
    setFailure(false);
    try {
      setOrders(
        await matchingOrders({
          organizationId: input.props.organizationId,
          locationId: input.props.locationId,
          posSessionId: input.props.posSessionId,
          query: input.query,
        }),
      );
    } catch {
      setFailure(true);
    }
  }

  async function submitReturn(): Promise<void> {
    if (input.selected === null || pending) return;
    const body = {
      orderId: input.selected.orderId,
      lines: pickedLinesOf(input.selected, input.quantities),
      refundMethod: "CASH" as const,
      reasonKey: input.reason,
      ...(input.note.trim() === "" ? {} : { note: input.note.trim() }),
    };
    if (body.lines.length === 0) return;
    const attempt = attemptFor(attemptRef.current, JSON.stringify(body));
    attemptRef.current = attempt;
    setPending(true);
    setFailure(false);
    try {
      setResult(await createTillReturn(input.props.organizationId, body, attempt.idempotencyKey));
    } catch {
      setFailure(true);
    } finally {
      setPending(false);
    }
  }

  return { orders, failure, pending, result, findOrders, submitReturn };
}

function returnableOrder(order: OrderResponse, locationId: string): boolean {
  return order.locationId === locationId && order.status === ORDER_STATUS.COMPLETED;
}

async function matchingOrders(input: {
  readonly organizationId: string;
  readonly locationId: string;
  readonly posSessionId: string;
  readonly query: string;
}): Promise<readonly OrderResponse[]> {
  const params = new URLSearchParams({
    locationId: input.locationId,
    status: ORDER_STATUS.COMPLETED,
    limit: "20",
    page: "1",
  });
  if (input.query.trim()) params.set("q", input.query.trim());
  const page = await listOrders(input.organizationId, params.toString());
  const orders = await Promise.all(
    page.items.map((item) => getOrder(input.organizationId, item.orderId)),
  );
  return orders
    .filter((order) => returnableOrder(order, input.locationId))
    .sort((left, right) => compareSessionThenDate(left, right, input.posSessionId));
}

function compareSessionThenDate(
  left: OrderResponse,
  right: OrderResponse,
  posSessionId: string,
): number {
  const leftMatches = left.posSessionId === posSessionId ? 1 : 0;
  const rightMatches = right.posSessionId === posSessionId ? 1 : 0;
  return rightMatches - leftMatches || right.createdAt.localeCompare(left.createdAt);
}

export function PosReturnSheet(props: PosReturnSheetProps): ReactElement {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OrderResponse | null>(null);
  const [quantities, setQuantities] = useState<Readonly<Record<string, number>>>({});
  const [reason, setReason] = useState<SalesReturnReason>(SALES_RETURN_REASON.CHANGED_MIND);
  const [note, setNote] = useState("");
  const actions = useReturnActions({ props, query, selected, quantities, reason, note });

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={props.labels.till.return} closeLabel={props.labels.till.approvalClose}>
        {actions.result !== null ? (
          <ReturnResult
            result={actions.result}
            labels={props.labels}
            locale={props.locale}
            onClose={props.onClose}
          />
        ) : null}
        {actions.result === null && selected === null ? (
          <ReturnSearchPanel
            query={query}
            orders={actions.orders}
            failure={actions.failure}
            labels={props.labels}
            locale={props.locale}
            onQueryChange={setQuery}
            onFind={() => void actions.findOrders()}
            onChoose={(order) => {
              setSelected(order);
              setQuantities({});
            }}
          />
        ) : null}
        {actions.result === null && selected !== null ? (
          <SelectedReturnPanel
            order={selected}
            quantities={quantities}
            reason={reason}
            note={note}
            pending={actions.pending}
            labels={props.labels}
            onSelectOrder={() => setSelected(null)}
            onQuantity={(orderLineId, quantity) =>
              setQuantities((current) => ({ ...current, [orderLineId]: quantity }))
            }
            onReason={setReason}
            onNote={setNote}
            onSubmit={() => void actions.submitReturn()}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
