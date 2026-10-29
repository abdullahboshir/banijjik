import type { SiteDomainResponse, SiteDraftResponse } from "@banijjik/contracts/website";
import { apiFetch } from "../lib/api/api-client";

function domainsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/website/domains${suffix}`;
}

export interface DomainMutation {
  readonly organizationId: string;
  readonly siteDomainId: string;
  readonly version: number;
  readonly idempotencyKey: string;
}

/** `POST /website/domains`; retries of the same hostname reuse the Idempotency-Key. */
export async function addSiteDomain(input: {
  readonly organizationId: string;
  readonly hostname: string;
  readonly idempotencyKey: string;
}): Promise<SiteDomainResponse> {
  const result = await apiFetch<SiteDomainResponse>(domainsPath(input.organizationId), {
    method: "POST",
    body: { hostname: input.hostname },
    idempotencyKey: input.idempotencyKey,
  });
  return result.data;
}

export async function verifySiteDomain(input: DomainMutation): Promise<SiteDomainResponse> {
  const result = await apiFetch<SiteDomainResponse>(
    domainsPath(input.organizationId, `/${input.siteDomainId}/verify`),
    { method: "POST", body: { version: input.version }, idempotencyKey: input.idempotencyKey },
  );
  return result.data;
}

export async function removeSiteDomain(input: DomainMutation): Promise<SiteDomainResponse> {
  const result = await apiFetch<SiteDomainResponse>(
    domainsPath(input.organizationId, `/${input.siteDomainId}?version=${input.version}`),
    { method: "DELETE", idempotencyKey: input.idempotencyKey },
  );
  return result.data;
}

export async function selectCanonicalSiteDomain(
  input: DomainMutation & { readonly expectedSiteVersion: number },
): Promise<SiteDomainResponse> {
  const result = await apiFetch<SiteDomainResponse>(
    domainsPath(input.organizationId, `/${input.siteDomainId}`),
    {
      method: "PATCH",
      body: {
        version: input.version,
        expectedSiteVersion: input.expectedSiteVersion,
        isCanonical: true,
      },
      idempotencyKey: input.idempotencyKey,
    },
  );
  return result.data;
}

/** `GET /website/site`: the CAS token the canonical switch needs. */
export async function fetchSiteDraft(organizationId: string): Promise<SiteDraftResponse> {
  const result = await apiFetch<SiteDraftResponse>(`/orgs/${organizationId}/website/site`);
  return result.data;
}
