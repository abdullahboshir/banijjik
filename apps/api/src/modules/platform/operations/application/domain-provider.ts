import type { DnsInstruction } from "@banijjik/contracts/website";
import type { SiteDomainId } from "@banijjik/ids";
import type { DomainOperation, DomainOperationAction } from "../domain/domain-operation.entity.js";

export class ProviderUnavailableError extends Error {
  constructor() {
    super("domain_provider_unavailable");
    this.name = "ProviderUnavailableError";
  }
}

export interface EnsureDomainInput {
  readonly hostname: string;
  /** Stable across retries of the same SiteDomain generation so a lost response can be reconciled. */
  readonly operationKey: string;
}

export interface EnsureDomainResult {
  readonly providerHostnameId: string;
  readonly ownershipRecords: readonly DnsInstruction[];
  readonly certificateRecords: readonly DnsInstruction[];
}

export interface InspectDomainResult {
  readonly hostnameActive: boolean;
  readonly certificateActive: boolean;
  readonly dnsTargetsService: boolean;
  readonly ownershipRecords: readonly DnsInstruction[];
  readonly certificateRecords: readonly DnsInstruction[];
  readonly diagnosticKey: string | null;
  readonly providerHostnameId: string | null;
}

/**
 * Cloudflare (or a test fake). Production never falls back to a fake (plan 4.2 A3).
 * `dnsTargetsService` is a bounded DNS check, never an HTTP fetch to a tenant URL.
 */
export interface DomainOperationRepository {
  findByNaturalKey(input: {
    readonly siteDomainId: SiteDomainId;
    readonly generation: number;
    readonly action: DomainOperationAction;
  }): Promise<DomainOperation | undefined>;
  insert(operation: DomainOperation): Promise<"inserted" | "duplicate">;
  save(operation: DomainOperation, expectedVersion: number): Promise<void>;
}

export interface DomainProvider {
  ensure(input: EnsureDomainInput): Promise<EnsureDomainResult>;
  inspect(hostname: string): Promise<InspectDomainResult>;
  remove(providerHostnameId: string): Promise<void>;
}
