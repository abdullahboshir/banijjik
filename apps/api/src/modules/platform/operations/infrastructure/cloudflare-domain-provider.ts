import type { DnsInstruction } from "@banijjik/contracts/website";
import type { CloudflareConfig } from "../../../../config/read-cloudflare-config.js";
import {
  ProviderUnavailableError,
  type DomainProvider,
  type EnsureDomainInput,
  type EnsureDomainResult,
  type InspectDomainResult,
} from "../application/domain-provider.js";

const REQUEST_TIMEOUT_MS = 8_000;
const DNS_TIMEOUT_MS = 2_000;
const SAFE_DIAGNOSTIC = /^[a-z][a-z0-9_.-]{0,99}$/;

interface CloudflareCustomHostname {
  readonly id?: string;
  readonly status?: string;
  readonly ownership_verification?: {
    readonly type?: string;
    readonly name?: string;
    readonly value?: string;
  };
  readonly ssl?: {
    readonly status?: string;
    readonly txt_name?: string;
    readonly txt_value?: string;
    readonly validation_records?: readonly {
      readonly txt_name?: string;
      readonly txt_value?: string;
    }[];
  };
}

interface CloudflareListResponse {
  readonly success?: boolean;
  readonly result?: unknown;
}

function providerUnavailable(): ProviderUnavailableError {
  return new ProviderUnavailableError();
}

function diagnosticKeyOf(status: string | undefined): string | null {
  if (status === undefined || status.length === 0) return null;
  const key = status.toLowerCase().replaceAll(" ", "_");
  return SAFE_DIAGNOSTIC.test(key) ? key : "unknown_status";
}

function txtInstruction(
  name: string | undefined,
  value: string | undefined,
): DnsInstruction | undefined {
  if (name === undefined || value === undefined || name.length === 0 || value.length === 0) {
    return undefined;
  }
  return { type: "TXT", name, value };
}

function recordsOf(row: CloudflareCustomHostname): {
  readonly ownershipRecords: DnsInstruction[];
  readonly certificateRecords: DnsInstruction[];
} {
  const ownership = txtInstruction(
    row.ownership_verification?.name,
    row.ownership_verification?.value,
  );
  const fromSsl = (row.ssl?.validation_records ?? [])
    .map((record) => txtInstruction(record.txt_name, record.txt_value))
    .filter((record): record is DnsInstruction => record !== undefined);
  const fallbackSsl = txtInstruction(row.ssl?.txt_name, row.ssl?.txt_value);
  const certificateRecords = certificateList(fromSsl, fallbackSsl);
  return {
    ownershipRecords: ownership === undefined ? [] : [ownership],
    certificateRecords,
  };
}

function certificateList(
  fromSsl: readonly DnsInstruction[],
  fallbackSsl: DnsInstruction | undefined,
): DnsInstruction[] {
  if (fromSsl.length > 0) return [...fromSsl];
  return fallbackSsl === undefined ? [] : [fallbackSsl];
}

function inspectFromRow(
  row: CloudflareCustomHostname | undefined,
  dnsTargetsService: boolean,
): InspectDomainResult {
  if (row === undefined) {
    return {
      hostnameActive: false,
      certificateActive: false,
      dnsTargetsService,
      ownershipRecords: [],
      certificateRecords: [],
      diagnosticKey: null,
      providerHostnameId: null,
    };
  }
  const records = recordsOf(row);
  return {
    hostnameActive: row.status === "active",
    certificateActive: row.ssl?.status === "active",
    dnsTargetsService,
    ownershipRecords: records.ownershipRecords,
    certificateRecords: records.certificateRecords,
    diagnosticKey: diagnosticKeyOf(row.ssl?.status ?? row.status),
    providerHostnameId: row.id ?? null,
  };
}

/** Used when Cloudflare credentials are omitted. Never reports an active hostname. */
export class DisabledDomainProvider implements DomainProvider {
  async ensure(input: EnsureDomainInput): Promise<EnsureDomainResult> {
    void input;
    throw providerUnavailable();
  }

  async inspect(hostname: string): Promise<InspectDomainResult> {
    void hostname;
    return inspectFromRow(undefined, false);
  }

  async remove(providerHostnameId: string): Promise<void> {
    void providerHostnameId;
  }
}

export function createDomainProvider(config: CloudflareConfig): DomainProvider {
  if (config.driver === "disabled") return new DisabledDomainProvider();
  return new CloudflareDomainProvider(config);
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Cloudflare for SaaS custom hostnames. The token is sent as Authorization and is never logged.
 */
export class CloudflareDomainProvider implements DomainProvider {
  constructor(
    private readonly config: Extract<CloudflareConfig, { driver: "cloudflare" }>,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly lookupCname: (
      hostname: string,
    ) => Promise<readonly string[]> = lookupCnameRecords,
  ) {}

  async ensure(input: EnsureDomainInput): Promise<EnsureDomainResult> {
    const existing = await this.readHostname(input.hostname);
    if (existing?.id !== undefined) return this.toEnsure(existing);
    const created = await this.request("POST", this.collectionPath(), {
      hostname: input.hostname,
      ssl: { method: "txt", type: "dv" },
    });
    const row = firstHostname(created.result);
    if (row?.id === undefined) throw providerUnavailable();
    return this.toEnsure(row);
  }

  async inspect(hostname: string): Promise<InspectDomainResult> {
    const row = await this.readHostname(hostname);
    const dnsTargetsService = await this.cnameMatchesFallback(hostname);
    return inspectFromRow(row, dnsTargetsService);
  }

  async remove(providerHostnameId: string): Promise<void> {
    await this.request(
      "DELETE",
      `${this.collectionPath()}/${encodeURIComponent(providerHostnameId)}`,
    );
  }

  private collectionPath(): string {
    return `/zones/${this.config.zoneId}/custom_hostnames`;
  }

  private async readHostname(hostname: string): Promise<CloudflareCustomHostname | undefined> {
    const listed = await this.request(
      "GET",
      `${this.collectionPath()}?hostname=${encodeURIComponent(hostname)}`,
    );
    return firstHostname(listed.result);
  }

  private toEnsure(row: CloudflareCustomHostname): EnsureDomainResult {
    if (row.id === undefined) throw providerUnavailable();
    const records = recordsOf(row);
    return {
      providerHostnameId: row.id,
      ownershipRecords: records.ownershipRecords,
      certificateRecords: records.certificateRecords,
    };
  }

  private async cnameMatchesFallback(hostname: string): Promise<boolean> {
    try {
      const records = await this.lookupCname(hostname);
      const expected = this.config.fallbackOrigin.toLowerCase();
      return records.some((record) => record.replace(/\.$/, "").toLowerCase() === expected);
    } catch {
      return false;
    }
  }

  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<CloudflareListResponse> {
    const response = await this.fetchImpl(`${this.config.apiBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404 && method === "DELETE") return { success: true, result: null };
    if (!response.ok) throw providerUnavailable();
    return (await response.json()) as CloudflareListResponse;
  }
}

function isHostnameRow(value: unknown): value is CloudflareCustomHostname {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstHostname(result: unknown): CloudflareCustomHostname | undefined {
  if (result === undefined || result === null) return undefined;
  if (Array.isArray(result)) {
    const first = result[0];
    return isHostnameRow(first) ? first : undefined;
  }
  return isHostnameRow(result) ? result : undefined;
}

async function lookupCnameRecords(hostname: string): Promise<readonly string[]> {
  const dns = await import("node:dns/promises");
  const resolver = new dns.Resolver();
  resolver.setServers(["1.1.1.1"]);
  const timer = setTimeout(() => resolver.cancel(), DNS_TIMEOUT_MS);
  try {
    return await resolver.resolveCname(hostname);
  } finally {
    clearTimeout(timer);
  }
}
