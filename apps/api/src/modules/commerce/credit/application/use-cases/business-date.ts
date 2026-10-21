/** The organization's business date as an ISO day, from the injected clock. */
export function businessDateOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}
