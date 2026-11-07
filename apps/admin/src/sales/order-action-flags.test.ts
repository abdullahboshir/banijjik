import { ORDER_STATUS } from "@banijjik/contracts/sales";
import { describe, expect, it } from "vitest";
import { orderActionFlagsOf, type OrderDetailPermissions } from "./order-action-flags";

const ALL_PERMISSIONS: OrderDetailPermissions = {
  canUpdate: true,
  canConfirm: true,
  canCancel: true,
  canReceive: true,
  canReturn: true,
  canExchange: true,
};

describe("orderActionFlagsOf", () => {
  it("enables canComplete for non-delivery CONFIRMED/PACKED orders", () => {
    const flags = orderActionFlagsOf(ORDER_STATUS.CONFIRMED, ALL_PERMISSIONS, false, "PICKUP");
    expect(flags.canComplete).toBe(true);
    expect(flags.canShip).toBe(false);
  });

  it("enables canShip instead of canComplete for COURIER delivery orders", () => {
    const flags = orderActionFlagsOf(ORDER_STATUS.CONFIRMED, ALL_PERMISSIONS, false, "COURIER");
    expect(flags.canShip).toBe(true);
    expect(flags.canComplete).toBe(false);
  });

  it("enables canShip for OWN_RIDER delivery orders", () => {
    const flags = orderActionFlagsOf(ORDER_STATUS.PACKED, ALL_PERMISSIONS, true, "OWN_RIDER");
    expect(flags.canShip).toBe(true);
    expect(flags.canComplete).toBe(false);
  });

  it("enables canFailAttempt when status is SHIPPED", () => {
    const flags = orderActionFlagsOf(ORDER_STATUS.SHIPPED, ALL_PERMISSIONS, false, "COURIER");
    expect(flags.canFailAttempt).toBe(true);
    expect(flags.canShip).toBe(false);
    expect(flags.canReship).toBe(false);
  });

  it("enables canReship, canRts, and canReconcileLoss when status is DELIVERY_FAILED", () => {
    const flags = orderActionFlagsOf(ORDER_STATUS.DELIVERY_FAILED, ALL_PERMISSIONS, false, "COURIER");
    expect(flags.canReship).toBe(true);
    expect(flags.canRts).toBe(true);
    expect(flags.canReconcileLoss).toBe(true);
    expect(flags.canShip).toBe(false);
  });

  it("enables canRecoverLoss when status is DELIVERY_LOSS_CLOSED", () => {
    const flags = orderActionFlagsOf(ORDER_STATUS.DELIVERY_LOSS_CLOSED, ALL_PERMISSIONS, false, "COURIER");
    expect(flags.canRecoverLoss).toBe(true);
    expect(flags.canReship).toBe(false);
  });
});
