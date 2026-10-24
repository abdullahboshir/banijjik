import type { OrderPostingSnapshot } from "../../domain/order-posting-rules.js";

/** Reads sales order data for revenue, advance settlement and cost of goods postings. */
export interface OrderPostingSource {
  readOrder(orderId: string): Promise<OrderPostingSnapshot | undefined>;
}
