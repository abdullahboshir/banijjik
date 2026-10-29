import { domainToASCII } from "node:url";

/** DNS allows 253 characters for the whole name without the terminal dot. */
const MAX_HOSTNAME_LENGTH = 253;
/** A host is at least an apex plus one label: a bare TLD or a single label is never a site host. */
const MIN_LABEL_COUNT = 2;
const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;
/**
 * Characters no host header may carry into a claim: whitespace, URL separators, userinfo, a port
 * separator, a comma (two hosts in one header) and a wildcard (plan 4.2 decision 2).
 */
const FORBIDDEN_CHARACTERS = /[\s/?#@,:*\\]/;

/**
 * The canonical form of a host name, or undefined when it cannot be a site host (plan 4.2 decision 2).
 * IDNA maps an international name to its punycode form; the stored claim is always that ASCII form.
 */
export function normalizeHostname(raw: string): string | undefined {
  const candidate = withoutTerminalDot(raw);
  if (candidate === undefined) return undefined;
  const ascii = domainToASCII(candidate);
  return isClaimableAscii(ascii) ? ascii : undefined;
}

function withoutTerminalDot(raw: string): string | undefined {
  const lowered = raw.trim().toLowerCase();
  if (lowered === "" || FORBIDDEN_CHARACTERS.test(lowered)) return undefined;
  const stripped = lowered.endsWith(".") ? lowered.slice(0, -1) : lowered;
  // "shop.example.com.." still ends with a dot after removing one, so it carries an empty label.
  if (stripped === "" || stripped.endsWith(".")) return undefined;
  return stripped;
}

function isClaimableAscii(ascii: string): boolean {
  if (ascii === "" || ascii.length > MAX_HOSTNAME_LENGTH) return false;
  const labels = ascii.split(".");
  if (labels.length < MIN_LABEL_COUNT) return false;
  if (!labels.every((label) => LABEL_PATTERN.test(label))) return false;
  // The request reaches us as a name, so a bare IPv4 literal is a misconfiguration, not a site.
  return !IPV4_PATTERN.test(ascii);
}

/** The hosts the platform itself uses, read from configuration. An apex of the SaaS zone cannot be claimed. */
export interface HostnameReservations {
  /** The storefront apex, e.g. `sites.example.com`; it routes to nothing by itself. */
  readonly baseDomain: string;
  /** Exact platform hosts such as `api.sites.example.com` or `admin.sites.example.com`. */
  readonly reservedHostnames: readonly string[];
}

/** True when the host belongs to the platform, so no business may claim it (plan 4.2 decision 2). */
export function isReservedHostname(hostname: string, reservations: HostnameReservations): boolean {
  if (hostname === normalizeHostname(reservations.baseDomain)) return true;
  return reservations.reservedHostnames.some(
    (reserved) => normalizeHostname(reserved) === hostname,
  );
}
