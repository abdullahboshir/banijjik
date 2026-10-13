import { isIP } from "node:net";

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const AUTHORITY_END_PATTERN = /[/?#]/;
const FIRST_OCTET_OF_LOOPBACK = 127;
const UNSPECIFIED_IPV4 = "0.0.0.0";
// "::ffff:7f00:1" (IPv4-mapped) and "::7f00:1" (IPv4-compatible): the last 32 bits are an IPv4 address.
const IPV6_WITH_IPV4_TAIL = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/;
const BYTE_SHIFT = 8;

/** The `host[:port]` entries of a URL; a MongoDB URL may list several, separated by commas. */
function readHostEntries(url: string): string[] {
  const afterScheme = url.replace(SCHEME_PATTERN, "");
  const authority = afterScheme.split(AUTHORITY_END_PATTERN, 1)[0] ?? "";
  // The password may contain an "@", so the host list starts after the last one.
  const hostList = authority.slice(authority.lastIndexOf("@") + 1);
  return hostList.split(",");
}

/**
 * The URL parser does the spelling work: it lowercases, drops the port, writes IPv6 in its short form
 * and turns "0x7f.1" or "2130706433" into 127.0.0.1. A host it cannot parse cannot be connected to either.
 */
function readHostname(hostEntry: string): string | undefined {
  const candidate = `http://${hostEntry}`;
  if (!URL.canParse(candidate)) return undefined;
  const hostname = new URL(candidate).hostname;
  const withoutBrackets = hostname.replace(/^\[|\]$/g, "");
  // "localhost." is the fully qualified spelling of the same machine, and DNS resolves it just the same.
  return withoutBrackets.replace(/\.$/, "");
}

function isLocalIpv4(address: string): boolean {
  const firstOctet = Number(address.split(".")[0]);
  return firstOctet === FIRST_OCTET_OF_LOOPBACK || address === UNSPECIFIED_IPV4;
}

function isLocalIpv6(address: string): boolean {
  if (address === "::1" || address === "::") return true;
  const tail = IPV6_WITH_IPV4_TAIL.exec(address);
  if (tail === null) return false;
  const high = Number.parseInt(tail[1] ?? "", 16);
  const low = Number.parseInt(tail[2] ?? "", 16);
  const isUnspecified = high === 0 && low === 0;
  return high >> BYTE_SHIFT === FIRST_OCTET_OF_LOOPBACK || isUnspecified;
}

function isLocalHostname(hostname: string): boolean {
  if (hostname === "localhost") return true;
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) return isLocalIpv4(hostname);
  return ipVersion === 6 && isLocalIpv6(hostname);
}

/**
 * True when any host of the URL is this machine: `localhost`, any 127.0.0.0/8 address, 0.0.0.0,
 * `::1`, `::` or an IPv4-mapped one of those, in any spelling. Whole labels only, so a real host
 * such as `mylocalhost.example.com` is not mistaken for it.
 */
export function isLocalHostUrl(url: string): boolean {
  return readHostEntries(url).some((entry) => {
    const hostname = readHostname(entry);
    return hostname !== undefined && isLocalHostname(hostname);
  });
}
