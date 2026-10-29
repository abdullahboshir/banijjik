import { domainToASCII } from "node:url";

const MAX_HOST_LENGTH = 253;
const MAX_LABELS = 127;
const MIN_LABELS = 2;
const MAX_CACHE_ENTRIES = 2_000;
const NEGATIVE_CACHE_TTL_MS = 30_000;
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const FORBIDDEN_HOST_CHARACTERS = /[\s/?#@,:*\\]/;

export interface StorefrontHostResolution {
  readonly organizationId: string;
  readonly generation: number;
  readonly canonicalHostname: string;
  readonly publishedWebsiteVersionId: string;
}

export interface HostResolverOptions {
  readonly fetchResolution: (hostname: string) => Promise<StorefrontHostResolution | undefined>;
  readonly now: () => number;
}

export interface HostResolver {
  resolve: (host: string) => Promise<StorefrontHostResolution | undefined>;
}

type CacheEntry =
  | { readonly kind: "parsed"; readonly hostname: string | undefined }
  | { readonly kind: "negative"; readonly expiresAt: number };

function normalizedInputKey(host: string): string {
  return host.trim().toLowerCase();
}

function parseHostname(host: string): string | undefined {
  const withoutLocalhostPort = host.replace(/^(.*\.localhost):\d{1,5}$/i, "$1");
  const ascii = toAsciiHostname(withoutLocalhostPort);
  if (ascii === undefined || !hasValidHostnameLabels(ascii)) return undefined;
  return ascii;
}

function toAsciiHostname(host: string): string | undefined {
  if (FORBIDDEN_HOST_CHARACTERS.test(host)) return undefined;
  const withoutTerminalDot = host.endsWith(".") ? host.slice(0, -1) : host;
  if (withoutTerminalDot === "" || withoutTerminalDot.endsWith(".")) return undefined;
  const ascii = domainToASCII(withoutTerminalDot.toLowerCase());
  if (ascii === "" || ascii.length > MAX_HOST_LENGTH || IPV4.test(ascii)) return undefined;
  return ascii;
}

function hasValidHostnameLabels(hostname: string): boolean {
  const labels = hostname.split(".");
  return (
    labels.length >= MIN_LABELS &&
    labels.length <= MAX_LABELS &&
    labels.every((label) => HOST_LABEL.test(label))
  );
}

/** Normalizes host syntax and caches only parsing and short-lived unknown-host answers. */
export function createHostResolver(options: HostResolverOptions): HostResolver {
  const cache = new Map<string, CacheEntry>();

  function readFresh(key: string): CacheEntry | undefined {
    const entry = cache.get(key);
    if (entry === undefined) return undefined;
    if (entry.kind === "negative" && entry.expiresAt <= options.now()) {
      cache.delete(key);
      return undefined;
    }
    cache.delete(key);
    cache.set(key, entry);
    return entry;
  }

  function writeCache(key: string, entry: CacheEntry): void {
    cache.delete(key);
    cache.set(key, entry);
    while (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) return;
      cache.delete(oldest);
    }
  }

  async function resolve(host: string): Promise<StorefrontHostResolution | undefined> {
    const inputKey = normalizedInputKey(host);
    const parseKey = `parse:${inputKey}`;
    const cachedParse = readFresh(parseKey);
    const normalizedHost =
      cachedParse?.kind === "parsed" ? cachedParse.hostname : parseHostname(inputKey);
    if (cachedParse?.kind !== "parsed") {
      writeCache(parseKey, { kind: "parsed", hostname: normalizedHost });
    }
    if (normalizedHost === undefined) return undefined;

    const negativeKey = `negative:${normalizedHost}`;
    if (readFresh(negativeKey)?.kind === "negative") return undefined;

    const resolution = await options.fetchResolution(normalizedHost);
    if (resolution === undefined) {
      writeCache(negativeKey, {
        kind: "negative",
        expiresAt: options.now() + NEGATIVE_CACHE_TTL_MS,
      });
    }
    return resolution;
  }

  return { resolve };
}
