import { storefrontApiOrigin } from "../config/environment";
import { STOREFRONT_API_PREFIX } from "../config/storefront-config";
import { createSystemHostResolver } from "./host-resolver";

interface ResolveBody {
  readonly data: { readonly organizationId: string };
}

/** Asks the API which business the host belongs to (14-API section 6). 404 is an unknown host. */
async function fetchOrganizationIdForHost(host: string): Promise<string | undefined> {
  const url = `${storefrontApiOrigin()}${STOREFRONT_API_PREFIX}/resolve?host=${encodeURIComponent(host)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`resolve answered ${response.status}`);
  const body = (await response.json()) as ResolveBody;
  return body.data.organizationId;
}

const hostResolver = createSystemHostResolver(fetchOrganizationIdForHost);

/** The business a Host belongs to, from the in-process cache when the answer is fresh. */
export function resolveHostOrganization(host: string): Promise<string | undefined> {
  return hostResolver.resolve(host);
}
