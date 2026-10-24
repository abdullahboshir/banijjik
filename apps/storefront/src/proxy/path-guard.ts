/**
 * Decides which upstream paths the browser may reach through the proxy. The organization in the path
 * must be the one the Host resolved to: a path that names another business is refused before it is
 * forwarded (M.6 decision 10). Dot segments are refused so no path can climb out of the allowed prefix.
 */
const DOT_SEGMENTS: ReadonlySet<string> = new Set([".", ".."]);
const RESOLVE_SEGMENT = "resolve";
const ORGANIZATIONS_SEGMENT = "orgs";

function hasDotSegment(segments: readonly string[]): boolean {
  return segments.some((segment) => DOT_SEGMENTS.has(segment) || segment.includes("\\"));
}

/** `segments` are the decoded parts after `/api/v1/storefront/`. */
export function isAllowedStorefrontPath(
  segments: readonly string[],
  organizationId: string,
): boolean {
  if (segments.length === 0 || hasDotSegment(segments)) return false;
  const [first, second] = segments;
  if (first === RESOLVE_SEGMENT) return segments.length === 1;
  if (first !== ORGANIZATIONS_SEGMENT) return false;
  return second === organizationId;
}

/** `/api/v1/public/files/*` carries no business in the path; the API checks the file itself. */
export function isAllowedPublicFilePath(segments: readonly string[]): boolean {
  return segments.length > 0 && !hasDotSegment(segments);
}
