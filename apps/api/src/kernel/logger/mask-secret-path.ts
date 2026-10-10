import { INVITATION_TOKEN_LENGTH } from "@banijjik/contracts";

const MASK = ":token";

/**
 * `/invitations/<token>`: the secret is a path segment of exactly 43 base64url characters. Domain
 * IDs are 36 characters with hyphens, so they never match and stay readable in the log.
 */
const INVITATION_TOKEN_SEGMENT = new RegExp(
  `(/invitations/)[A-Za-z0-9_-]{${INVITATION_TOKEN_LENGTH}}(?=/|$|\\?)`,
);

/**
 * Hides secrets that travel in the path (the invitation token) before a path is written to a log
 * line. Every place that logs a request path goes through this function.
 */
export function maskSecretPathSegments(path: string): string {
  return path.replace(INVITATION_TOKEN_SEGMENT, `$1${MASK}`);
}
