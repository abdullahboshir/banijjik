"use client";

import type { OrderResponse } from "@banijjik/contracts/sales";
import { Button, FormField, Sheet, SheetContent, TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { OrderLabels } from "../order-labels";
import { showSuccessToast } from "../order-toast";
import { reconcileDeliveryLoss, recoverDeliveryLoss } from "./fulfillment-api";

export interface DeliveryLossSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly labels: OrderLabels;
  readonly isRecover?: boolean;
}

interface LineLossState {
  readonly restock: number;
  readonly damaged: number;
  readonly lost: number;
}

export function DeliveryLossSheet(props: DeliveryLossSheetProps): ReactElement | null {
  const { open, onOpenChange, organizationId, order, labels, isRecover = false } = props;
  const router = useRouter();

  const [reasonKey, setReasonKey] = useState("GOODS_LOST_IN_TRANSIT");
  const [approvalToken, setApprovalToken] = useState("approved");
  const [lines, setLines] = useState<Record<string, LineLossState>>(() => {
    const init: Record<string, LineLossState> = {};
    for (const line of order.lines) {
      init[line.orderLineId] = {
        restock: 0,
        damaged: 0,
        lost: isRecover ? 0 : line.quantity,
      };
    }
    return init;
  });
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleLineChange = (orderLineId: string, field: "restock" | "damaged" | "lost", value: number) => {
    setLines((prev) => ({
      ...prev,
      [orderLineId]: {
        restock: prev[orderLineId]?.restock ?? 0,
        damaged: prev[orderLineId]?.damaged ?? 0,
        lost: prev[orderLineId]?.lost ?? 0,
        [field]: Math.max(0, value),
      },
    }));
    setError(undefined);
  };

  const handleSubmit = async () => {
    if (!approvalToken.trim()) {
      setError(labels.approval.pin);
      return;
    }

    if (!isRecover) {
      let totalLost = 0;
      for (const line of order.lines) {
        const lineState = lines[line.orderLineId] ?? { restock: 0, damaged: 0, lost: 0 };
        const sum = lineState.restock + lineState.damaged + lineState.lost;
        if (sum !== line.quantity) {
          setError(`Line quantities must sum to ${line.quantity}`);
          return;
        }
        totalLost += lineState.lost;
      }
      if (totalLost <= 0) {
        setError("Total lost quantity must be greater than zero");
        return;
      }

      setIsSaving(true);
      setError(undefined);
      try {
        await reconcileDeliveryLoss(organizationId, order.orderId, {
          expectedVersion: order.version,
          reasonKey,
          approvalToken: approvalToken.trim(),
          lines: order.lines.map((l) => ({
            orderLineId: l.orderLineId,
            restockQuantity: lines[l.orderLineId]?.restock ?? 0,
            damagedQuantity: lines[l.orderLineId]?.damaged ?? 0,
            lostQuantity: lines[l.orderLineId]?.lost ?? 0,
          })),
        });
        showSuccessToast(labels.loss.successClose);
        onOpenChange(false);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsSaving(true);
      setError(undefined);
      try {
        await recoverDeliveryLoss(organizationId, order.orderId, {
          expectedVersion: order.version,
          approvalToken: approvalToken.trim(),
          lines: order.lines.map((l) => ({
            orderLineId: l.orderLineId,
            restockQuantity: lines[l.orderLineId]?.restock ?? 0,
            damagedQuantity: lines[l.orderLineId]?.damaged ?? 0,
          })),
        });
        showSuccessToast(labels.loss.successRecover);
        onOpenChange(false);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={isRecover ? labels.loss.recoverTitle : labels.loss.closeTitle}
        closeLabel={labels.actions.close}
      >
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">
            {isRecover ? labels.loss.recoverDescription : labels.loss.closeDescription}
          </p>

          {!isRecover ? (
            <FormField label={labels.rts.reason} htmlFor="loss-reason" required>
              <TextInput
                id="loss-reason"
                value={reasonKey}
                disabled={isSaving}
                onChange={(e) => setReasonKey(e.target.value)}
              />
            </FormField>
          ) : null}

          <FormField
            label={labels.approval.title}
            htmlFor="loss-approval"
            required
            {...(error !== undefined ? { error } : {})}
          >
            <TextInput
              id="loss-approval"
              value={approvalToken}
              disabled={isSaving}
              onChange={(e) => setApprovalToken(e.target.value)}
            />
          </FormField>

          <div className="flex flex-col gap-3 border-t pt-3">
            {order.lines.map((line) => {
              const lineState = lines[line.orderLineId] ?? { restock: 0, damaged: 0, lost: 0 };
              return (
                <div key={line.orderLineId} className="flex flex-col gap-2 rounded border p-3">
                  <div className="flex justify-between font-medium">
                    <span>{line.nameSnapshot}</span>
                    <span>Total: {line.quantity}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <FormField label={labels.loss.restock} htmlFor={`restock-${line.orderLineId}`}>
                      <TextInput
                        id={`restock-${line.orderLineId}`}
                        type="number"
                        min={0}
                        max={line.quantity}
                        value={String(lineState.restock)}
                        disabled={isSaving}
                        onChange={(e) =>
                          handleLineChange(line.orderLineId, "restock", Number(e.target.value))
                        }
                      />
                    </FormField>
                    <FormField label={labels.loss.damaged} htmlFor={`damaged-${line.orderLineId}`}>
                      <TextInput
                        id={`damaged-${line.orderLineId}`}
                        type="number"
                        min={0}
                        max={line.quantity}
                        value={String(lineState.damaged)}
                        disabled={isSaving}
                        onChange={(e) =>
                          handleLineChange(line.orderLineId, "damaged", Number(e.target.value))
                        }
                      />
                    </FormField>
                    {!isRecover ? (
                      <FormField label={labels.loss.lost} htmlFor={`lost-${line.orderLineId}`}>
                        <TextInput
                          id={`lost-${line.orderLineId}`}
                          type="number"
                          min={0}
                          max={line.quantity}
                          value={String(lineState.lost)}
                          disabled={isSaving}
                          onChange={(e) =>
                            handleLineChange(line.orderLineId, "lost", Number(e.target.value))
                          }
                        />
                      </FormField>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              {labels.actions.close}
            </Button>
            <Button isLoading={isSaving} onClick={() => void handleSubmit()}>
              {isRecover ? labels.loss.submitRecover : labels.loss.submitClose}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
