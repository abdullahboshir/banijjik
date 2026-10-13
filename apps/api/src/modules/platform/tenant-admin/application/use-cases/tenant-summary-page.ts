import type { TenantSummary } from "./tenant-summary.js";

export interface TenantSummaryPage {
  readonly items: readonly TenantSummary[];
  readonly hasNext: boolean;
}
