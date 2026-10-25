import type { OrderTotals } from "@banijjik/contracts/sales";
import { models, sessionOption, getActiveSession } from "../../../../kernel/db/index.js";
import { ORDER_MODEL_NAME, type OrderDocument } from "./sales.schema.js";
import { totalsOf } from "./mongo-order.mapper.js";

export interface OrderTotalsRow {
  readonly orderId: string;
  readonly totals: OrderTotals;
}

/** The money totals of the orders one register sold: the Z-report sums them without loading lines. */
export interface OrderTotalsReader {
  readByPosSession(posSessionId: string): Promise<readonly OrderTotalsRow[]>;
}

const TOTALS_PROJECTION = { _id: 0, orderId: 1, totals: 1 };

export function buildOrderTotalsReader(): OrderTotalsReader {
  return {
    async readByPosSession(posSessionId) {
      const rows = await models({})
        .get<OrderDocument>(ORDER_MODEL_NAME)
        .find({ posSessionId }, TOTALS_PROJECTION, sessionOption(getActiveSession()))
        .lean<Pick<OrderDocument, "orderId" | "totals">[]>();
      return rows.map((row) => ({ orderId: row.orderId, totals: totalsOf(row.totals) }));
    },
  };
}
