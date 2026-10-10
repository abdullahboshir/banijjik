import { createHash } from "node:crypto";

export interface RequestFingerprint {
  readonly method: string;
  /** `baseUrl + route.path`, e.g. `/api/v1/me/orgs`. */
  readonly routePattern: string;
  /** The validated path parameters: a route like `/roles/:roleId/archive` differs per role. */
  readonly params: unknown;
  readonly body: unknown;
}

/** Sorts object keys recursively so two bodies that differ only in key order serialize equally. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;
  // Safe: a non-null, non-array object here is a plain JSON object (parsed request body or params).
  const source = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) sorted[key] = sortKeys(source[key]);
  return sorted;
}

/** JSON with recursively sorted keys. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value ?? null));
}

/**
 * SHA-256 over method, route pattern, parameters and body. The same key with the same hash is a
 * retry; the same key with another hash is a client bug (`422 IDEMPOTENCY_MISMATCH`).
 */
export function computeRequestHash(fingerprint: RequestFingerprint): string {
  const { method, routePattern, params, body } = fingerprint;
  const canonical = `${method.toUpperCase()} ${routePattern}\n${canonicalJson(params)}\n${canonicalJson(body)}`;
  return createHash("sha256").update(canonical).digest("hex");
}
