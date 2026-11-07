"use client";

import type { OrderResponse } from "@banijjik/contracts/sales";
import { Button, FormField, Select, Sheet, SheetContent, TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { OrderLabels } from "../order-labels";
import { showSuccessToast } from "../order-toast";
import { reshipOrder, shipOrder } from "./fulfillment-api";

export interface OrderShipSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly labels: OrderLabels;
  readonly isReship?: boolean;
}

export function OrderShipSheet(props: OrderShipSheetProps): ReactElement | null {
  const { open, onOpenChange, organizationId, order, labels, isReship = false } = props;
  const router = useRouter();

  const initialMethod =
    order.fulfillment.method === "OWN_RIDER" ? "OWN_RIDER" : "COURIER";
  const [method, setMethod] = useState<"COURIER" | "OWN_RIDER">(initialMethod);
  const [consignmentId, setConsignmentId] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (method === "COURIER" && !consignmentId.trim()) {
      setError(labels.ship.consignmentPlaceholder);
      return;
    }
    if (method === "OWN_RIDER" && !assignmentId.trim()) {
      setError(labels.ship.assignmentPlaceholder);
      return;
    }

    setIsSaving(true);
    setError(undefined);
    try {
      const dispatch =
        method === "COURIER"
          ? { method: "COURIER" as const, consignmentId: consignmentId.trim() }
          : { method: "OWN_RIDER" as const, deliveryAssignmentId: assignmentId.trim() };

      if (isReship) {
        await reshipOrder(organizationId, order.orderId, {
          version: order.version,
          dispatch,
        });
        showSuccessToast(labels.ship.reshipSuccess);
      } else {
        await shipOrder(organizationId, order.orderId, {
          version: order.version,
          dispatch,
        });
        showSuccessToast(labels.ship.success);
      }
      onOpenChange(false);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={isReship ? labels.ship.reshipTitle : labels.ship.title}
        closeLabel={labels.actions.close}
      >
        <div className="flex flex-col gap-4">
          <FormField label={labels.ship.method} htmlFor="ship-method">
            <Select
              id="ship-method"
              value={method}
              disabled={isSaving}
              onChange={(e) => {
                setMethod(e.target.value as "COURIER" | "OWN_RIDER");
                setError(undefined);
              }}
            >
              <option value="COURIER">{labels.ship.courier}</option>
              <option value="OWN_RIDER">{labels.ship.rider}</option>
            </Select>
          </FormField>

          {method === "COURIER" ? (
            <FormField
              label={labels.ship.consignmentId}
              htmlFor="ship-consignment-id"
              required
              {...(error !== undefined ? { error } : {})}
            >
              <TextInput
                id="ship-consignment-id"
                value={consignmentId}
                disabled={isSaving}
                placeholder={labels.ship.consignmentPlaceholder}
                onChange={(e) => {
                  setConsignmentId(e.target.value);
                  setError(undefined);
                }}
              />
            </FormField>
          ) : (
            <FormField
              label={labels.ship.assignmentId}
              htmlFor="ship-assignment-id"
              required
              {...(error !== undefined ? { error } : {})}
            >
              <TextInput
                id="ship-assignment-id"
                value={assignmentId}
                disabled={isSaving}
                placeholder={labels.ship.assignmentPlaceholder}
                onChange={(e) => {
                  setAssignmentId(e.target.value);
                  setError(undefined);
                }}
              />
            </FormField>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              {labels.actions.close}
            </Button>
            <Button isLoading={isSaving} onClick={() => void handleSubmit()}>
              {isReship ? labels.ship.reshipSubmit : labels.ship.submit}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
