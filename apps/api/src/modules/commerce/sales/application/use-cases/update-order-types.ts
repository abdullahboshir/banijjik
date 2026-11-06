import type { ManualDiscount } from "@banijjik/contracts/pricing";
import type {
  FulfillmentMethod,
  OrderTotals,
} from "@banijjik/contracts/sales";
import type { DeliveryAddress } from "@banijjik/contracts/sales/delivery";
import type { OrderId } from "@banijjik/ids";
import type { OrderContentChanges } from "../../domain/order-types.js";
import type { OrderWriteInput } from "./create-order.use-case.js";
import type { Order } from "../../domain/order.entity.js";
import type { OrderLineInput, PreparedLines } from "../sales-line-preparation.js";

export type ClearedContent = Pick<
  OrderContentChanges,
  "lines" | "totals" | "hasStockLines" | "deliveryZoneId"
> & {
  readonly approval: null;
};

export interface UpdateBody {
  readonly version: number;
  readonly lines?: readonly OrderLineInput[] | undefined;
  readonly orderDiscount?: ManualDiscount | null | undefined;
  readonly contactId?: string | null | undefined;
  readonly fulfillmentMethod?: FulfillmentMethod | undefined;
  readonly deliveryAddress?: DeliveryAddress | null | undefined;
  readonly note?: string | null | undefined;
  readonly customFields?: Readonly<Record<string, unknown>> | undefined;
  readonly approvalToken?: string | undefined;
}

export interface UpdateInput extends OrderWriteInput {
  readonly orderId: OrderId;
  readonly body: UpdateBody;
}

export interface PricedDelivery {
  readonly totals: OrderTotals;
  readonly deliveryZoneId: string | null;
}

export interface EditArgs {
  readonly existing: Order;
  readonly input: UpdateInput;
  readonly prepared: PreparedLines | undefined;
  readonly repriced: PricedDelivery | undefined;
  readonly ownerExemptBySetting: boolean;
}
