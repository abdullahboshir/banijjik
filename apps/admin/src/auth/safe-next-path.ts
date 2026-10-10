const HOME_PATH = "/";
const FIRST_PRINTABLE_CODE = 0x20;

function hasControlCharacter(candidate: string): boolean {
  return Array.from(candidate).some((character) => character.charCodeAt(0) < FIRST_PRINTABLE_CODE);
}

/**
 * The only way a `next` value from a URL becomes a redirect target. A same-origin path is kept; anything that a
 * browser could read as another site (`//host`, `/\host`, a scheme, control characters) becomes the home path.
 */
export function safeNextPath(candidate: string | null | undefined): string {
  if (!candidate) return HOME_PATH;
  if (!candidate.startsWith("/")) return HOME_PATH;
  if (candidate.startsWith("//") || candidate.includes("\\")) return HOME_PATH;
  if (hasControlCharacter(candidate)) return HOME_PATH;
  return candidate;
}

/** `/sign-in?next=...` for a person who has no session; the path goes through `safeNextPath` first. */
export function buildSignInPath(nextPath: string): string {
  return `/sign-in?next=${encodeURIComponent(safeNextPath(nextPath))}`;
}

/** `/session?next=...`: the client page that tries one silent renewal before the sign-in page. */
export function buildSessionRenewalPath(nextPath: string): string {
  return `/session?next=${encodeURIComponent(safeNextPath(nextPath))}`;
}
