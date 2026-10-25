import type { OrderResponse } from "@banijjik/contracts/sales";
import { asId, type OrderId } from "@banijjik/ids";
import { recordNotFound } from "../domain/errors.js";
import type { SalesDependencies } from "./sales-dependencies.js";
import {
  InstantOrderUseCase,
  type InstantSaleInput,
  type PreparedInstantSale,
} from "./use-cases/instant-order.use-case.js";
import { toOrderResponse } from "./sales-views.js";

export type { InstantSaleInput, PreparedInstantSale };

/**
 * The instant sale in two steps for a caller that owns the unit of work (the POS, plan 3.9
 * decision 4): `prepare` runs before the transaction, `commit` and `read` inside it. Behaviour
 * of `POST /orders/instant` is the same code run back to back.
 */
export interface InstantSaleService {
  prepare(input: InstantSaleInput): Promise<PreparedInstantSale>;
  /** The completed order with no payment yet. Run it inside the caller's unit of work. */
  commit(prepared: PreparedInstantSale): Promise<OrderResponse>;
  /** The order as it reads now, with its payment status derived from what has been paid. */
  read(orderId: string): Promise<OrderResponse>;
}

const NOTHING_PAID = { paidMinor: 0, refundedMinor: 0 };

export function buildInstantSaleService(dependencies: SalesDependencies): InstantSaleService {
  const instant = new InstantOrderUseCase(dependencies);
  return {
    prepare: (input) => instant.prepare(input),
    commit: async (prepared) => toOrderResponse(await instant.commit(prepared), NOTHING_PAID),
    read: async (orderId) => {
      const id = asId<OrderId>(orderId);
      const order = await dependencies.orders.findById(id);
      if (order === undefined) throw recordNotFound();
      return toOrderResponse(order, await dependencies.payments.readTotals(id));
    },
  };
}
