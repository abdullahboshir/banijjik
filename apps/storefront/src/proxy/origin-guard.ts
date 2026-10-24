const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * True when a write comes from another site. The session cookies are SameSite=Lax, which already keeps
 * most cross-site posts from carrying them; this refuses the rest before the API sees them (ADR-119).
 * A missing Origin is a same-site or non-browser call and is allowed; `null` (privacy modes) is refused.
 */
export function isForeignOriginWrite(input: {
  readonly method: string;
  readonly origin: string | null;
  readonly host: string | null;
}): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return false;
  if (input.origin === null) return false;
  return !isOwnHost(input.origin, input.host);
}

function isOwnHost(origin: string, host: string | null): boolean {
  if (host === null) return false;
  try {
    return new URL(origin).host === host.toLowerCase();
  } catch {
    return false;
  }
}
