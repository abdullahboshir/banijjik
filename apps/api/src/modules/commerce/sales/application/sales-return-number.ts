/** Customer-facing return number from the RETURN sequence (ADR-036): never the UUID, never a count. */
export function formatSalesReturnNumber(value: number): string {
  return `RTN-${String(value).padStart(6, "0")}`;
}
