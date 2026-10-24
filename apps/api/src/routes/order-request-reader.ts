import { ORDER_STATUS } from "@banijjik/contracts/sales";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { asId, type OrderId } from "@banijjik/ids";
import { buildOrderSnapshotReader } from "../modules/commerce/sales/index.js";
import type { RequestReader } from "../modules/commerce/payment/index.js";
export function buildOrderRequestReader(orders = buildOrderSnapshotReader()): RequestReader {
  return {
    read: async (organizationId, requestId) => {
      const order = await orders.read(asId<OrderId>(requestId));
      if (
        !order ||
        order.organizationId !== organizationId ||
        order.status === ORDER_STATUS.DRAFT ||
        order.status === ORDER_STATUS.CANCELLED
      )
        return undefined;
      return {
        requestId: order.orderId,
        requestType: PAYMENT_REQUEST_TYPE.ORDER,
        total: order.totals.grandTotal,
        contactId: order.contactId,
        locationId: order.locationId,
        revenueState: order.status === ORDER_STATUS.COMPLETED ? "AFTER_REVENUE" : "BEFORE_REVENUE",
      };
    },
  };
}
