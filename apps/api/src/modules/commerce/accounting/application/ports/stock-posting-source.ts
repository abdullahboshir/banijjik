import type { StockPostingSnapshot } from "../../domain/stock-posting-rules.js";

/** Reads inventory stock movement data for receipt, opening, adjustment and write-off postings. */
export interface StockPostingSource {
  readStockSource(source: {
    readonly organizationId: string;
    readonly sourceType: string;
    readonly sourceId: string;
  }): Promise<StockPostingSnapshot | undefined>;
}
