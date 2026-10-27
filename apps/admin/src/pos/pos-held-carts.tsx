"use client";

import {
  POS_API_MESSAGE_KEYS,
  POS_HELD_CART_LABEL_MAX_LENGTH,
  type PosCatalogRow,
  type PosHeldCartResponse,
} from "@banijjik/contracts/pos";
import { Button, FormField, Sheet, SheetContent, TextInput } from "@banijjik/ui";
import { useEffect, useState, type ReactElement } from "react";
import { ApiError } from "../lib/api/api-error";
import { cartLinesFromHeldPayload, heldCartPayloadOf, type CartLine } from "./cart";
import { createHeldCart, deleteHeldCart, listHeldCarts, listSalePerformers } from "./pos-api";
import { getTillCustomer } from "./pos-customer-api";
import type { PosLabels } from "./pos-labels";
import type { TillCustomer } from "./till-customer";

export type HeldCartMode = "hold" | "list";

export interface PosHeldCartsProps {
  readonly organizationId: string;
  readonly locationId: string;
  readonly labels: PosLabels;
  readonly mode: HeldCartMode;
  readonly lines: readonly CartLine[];
  readonly contactId: string | null;
  readonly rows: readonly PosCatalogRow[];
  readonly onHeld: () => void;
  readonly onResume: (lines: readonly CartLine[], customer: TillCustomer | null) => void;
  readonly onClose: () => void;
}

async function restoredLinesOf(
  cart: PosHeldCartResponse,
  props: PosHeldCartsProps,
): Promise<{ readonly lines: readonly CartLine[]; readonly customer: TillCustomer | null } | null> {
  const lines = cartLinesFromHeldPayload(cart.cart, props.rows);
  if (lines === null) return null;
  const [performers, customer] = await Promise.all([
    cart.cart.lines.some((line) => line.performedByMemberId !== undefined)
      ? listSalePerformers(props.organizationId, props.locationId)
      : Promise.resolve([]),
    cart.cart.contactId == null
      ? Promise.resolve(null)
      : getTillCustomer(props.organizationId, cart.cart.contactId),
  ]);
  const restoredLines = cartLinesFromHeldPayload(cart.cart, props.rows, performers);
  if (restoredLines === null) return null;
  return { lines: restoredLines, customer };
}

function HoldCartForm(props: PosHeldCartsProps): ReactElement {
  const [label, setLabel] = useState("");
  const [failureMessage, setFailureMessage] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function save(): Promise<void> {
    if (label.trim().length === 0 || pending) return;
    const heldCart = heldCartPayloadOf(props.lines, props.contactId);
    setPending(true);
    setFailureMessage(undefined);
    try {
      await createHeldCart(props.organizationId, {
        label: label.trim(),
        cart: {
          ...heldCart,
          lines: heldCart.lines.map((line) => ({
            ...line,
            modifierOptionIds: [...line.modifierOptionIds],
          })),
        },
      });
      props.onHeld();
    } catch (error) {
      setFailureMessage(
        error instanceof ApiError && error.messageKey === POS_API_MESSAGE_KEYS.heldCartLimit
          ? props.labels.till.limit
          : props.labels.saleFailed,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField label={props.labels.till.holdLabel} htmlFor="pos-held-cart-label">
        <TextInput
          id="pos-held-cart-label"
          maxLength={POS_HELD_CART_LABEL_MAX_LENGTH}
          className="min-h-14"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </FormField>
      {failureMessage === undefined ? null : <p role="alert">{failureMessage}</p>}
      <Button
        className="min-h-14"
        isLoading={pending}
        disabled={label.trim().length === 0}
        onClick={() => void save()}
      >
        {props.labels.till.holdSubmit}
      </Button>
    </div>
  );
}

function HeldCartList(props: PosHeldCartsProps): ReactElement {
  const [carts, setCarts] = useState<readonly PosHeldCartResponse[]>([]);
  const [selected, setSelected] = useState<PosHeldCartResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const items = await listHeldCarts(props.organizationId);
        if (!cancelled) setCarts(items);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [props.organizationId]);

  async function resume(cart: PosHeldCartResponse): Promise<void> {
    if (props.lines.length > 0 && selected?.posHeldCartId !== cart.posHeldCartId) return;
    setPending(true);
    try {
      const restored = await restoredLinesOf(cart, props);
      if (restored === null) {
        setFailed(true);
        return;
      }
      await deleteHeldCart(props.organizationId, cart);
      props.onResume(restored.lines, restored.customer);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {failed ? <p role="alert">{props.labels.loadFailed}</p> : null}
      {carts.length === 0 ? <p>{props.labels.till.noHeld}</p> : null}
      <ul className="flex flex-col gap-2">
        {carts.map((cart) => (
          <HeldCartRow
            key={cart.posHeldCartId}
            cart={cart}
            hasCurrentLines={props.lines.length > 0}
            pending={pending}
            selected={selected?.posHeldCartId === cart.posHeldCartId}
            labels={props.labels}
            onResume={() => void resume(cart)}
            onChoose={() => setSelected(cart)}
            onCancel={() => setSelected(null)}
          />
        ))}
      </ul>
    </div>
  );
}

function HeldCartRow(props: {
  readonly cart: PosHeldCartResponse;
  readonly hasCurrentLines: boolean;
  readonly pending: boolean;
  readonly selected: boolean;
  readonly labels: PosLabels;
  readonly onResume: () => void;
  readonly onChoose: () => void;
  readonly onCancel: () => void;
}): ReactElement {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-default p-3">
      <p className="font-semibold">{props.cart.label}</p>
      <Button
        className="min-h-14"
        disabled={props.pending}
        onClick={props.hasCurrentLines ? props.onChoose : props.onResume}
      >
        {props.labels.till.resume}
      </Button>
      {props.selected ? (
        <ResumeConfirmation
          hasCurrentLines={props.hasCurrentLines}
          pending={props.pending}
          labels={props.labels}
          onResume={props.onResume}
          onCancel={props.onCancel}
        />
      ) : null}
    </li>
  );
}

function ResumeConfirmation(props: {
  readonly hasCurrentLines: boolean;
  readonly pending: boolean;
  readonly labels: PosLabels;
  readonly onResume: () => void;
  readonly onCancel: () => void;
}): ReactElement {
  return (
    <div
      role="alertdialog"
      aria-label={props.labels.till.replaceConfirm}
      className="flex flex-col gap-2"
    >
      <p>{props.hasCurrentLines ? props.labels.till.replaceConfirm : props.labels.till.resume}</p>
      <Button className="min-h-14" disabled={props.pending} onClick={props.onResume}>
        {props.labels.till.resume}
      </Button>
      <Button variant="secondary" className="min-h-14" onClick={props.onCancel}>
        {props.labels.till.approvalCancel}
      </Button>
    </div>
  );
}

/** Lazy held-cart create and resume screens; the API re-quotes every resumed cart. */
export function PosHeldCarts(props: PosHeldCartsProps): ReactElement {
  const isHold = props.mode === "hold";
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent
        title={isHold ? props.labels.till.hold : props.labels.till.held}
        closeLabel={props.labels.till.approvalClose}
      >
        {isHold ? <HoldCartForm {...props} /> : <HeldCartList {...props} />}
      </SheetContent>
    </Sheet>
  );
}
