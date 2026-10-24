import type { SalesReturnPostingSnapshot } from "../../domain/sales-return-posting-rules.js";

/** Reads a sales return for its postings: its lines, delivery and rounding, and the cost that came back. */
export interface SalesReturnPostingSource {
  readSalesReturn(salesReturnId: string): Promise<SalesReturnPostingSnapshot | undefined>;
}
