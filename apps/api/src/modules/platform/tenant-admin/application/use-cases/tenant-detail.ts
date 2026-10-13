import type { TenantOverrideView, TenantSubscriptionView } from "../ports/tenant-admin-ports.js";
import type { TenantSummary } from "./tenant-summary.js";

export interface TenantDetail extends TenantSummary {
  readonly locationCount: number;
  readonly ownerDisplayName: string;
  readonly ownerMaskedIdentifier: string;
  readonly subscription: TenantSubscriptionView | null;
  readonly moduleOverrides: readonly TenantOverrideView[];
}
