/**
 * Error class and code only, for the `lastError` fields: a driver or client message can carry user
 * data or a connection URL, so it is never stored.
 */
export function summarizeError(error: unknown): string {
  if (!(error instanceof Error)) return "NonError";
  // Safe: only the optional client `code` is read from the error object.
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" || typeof code === "number"
    ? `${error.name} ${String(code)}`
    : error.name;
}
