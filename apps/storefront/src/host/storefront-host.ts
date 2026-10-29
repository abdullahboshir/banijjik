import { storefrontApiOrigin } from "../config/environment";
import { STOREFRONT_API_PREFIX } from "../config/storefront-config";
import { createHostResolver, type StorefrontHostResolution } from "./host-resolver";

interface ResolveBody {
  readonly data: StorefrontHostResolution;
}

function isHostResolution(value: unknown): value is StorefrontHostResolution {
  if (!isRecord(value)) return false;
  return (
    hasString(value, "organizationId") &&
    hasInteger(value, "generation") &&
    hasString(value, "canonicalHostname") &&
    hasString(value, "publishedWebsiteVersionId")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string";
}

function hasInteger(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "number" && Number.isInteger(value[key]);
}

async function fetchHostResolution(
  hostname: string,
): Promise<StorefrontHostResolution | undefined> {
  const url = `${storefrontApiOrigin()}${STOREFRONT_API_PREFIX}/resolve?host=${encodeURIComponent(hostname)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`storefront host lookup failed with ${response.status}`);

  const body = (await response.json()) as ResolveBody;
  if (!isHostResolution(body.data)) throw new Error("storefront host lookup returned invalid data");
  return body.data;
}

const hostResolver = createHostResolver({
  fetchResolution: fetchHostResolution,
  now: () => Date.now(),
});

export function resolveStorefrontHost(host: string): Promise<StorefrontHostResolution | undefined> {
  return hostResolver.resolve(host);
}
