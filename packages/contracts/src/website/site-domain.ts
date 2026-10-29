import { defineEnum } from "../define-enum.js";

export const SITE_DOMAIN_STATUS = defineEnum([
  "PENDING",
  "VERIFYING",
  "ACTIVE",
  "SUSPENDED",
  "FAILED",
  "REMOVING",
  "REMOVED",
]);

export type SiteDomainStatus = (typeof SITE_DOMAIN_STATUS)[keyof typeof SITE_DOMAIN_STATUS];

export interface DnsInstruction {
  readonly type: "CNAME" | "TXT";
  readonly name: string;
  readonly value: string;
}

export interface SiteDomainResponse {
  readonly siteDomainId: string;
  readonly hostname: string;
  readonly status: SiteDomainStatus;
  readonly version: number;
  readonly ownershipRecords: readonly DnsInstruction[];
  readonly certificateRecords: readonly DnsInstruction[];
  readonly diagnosticKey: string | null;
  /** Derived from Site.canonicalSiteDomainId; it is never persisted on a domain record. */
  readonly isCanonical: boolean;
}

export interface SiteDomainListResponse {
  readonly items: readonly SiteDomainResponse[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface DomainEventPayload {
  readonly siteDomainId: string;
  readonly operationGeneration: number;
}
