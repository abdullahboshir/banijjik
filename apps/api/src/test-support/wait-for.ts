const POLL_INTERVAL_MS = 25;
const DEFAULT_TIMEOUT_MS = 15_000;

/** Polls until `check` returns a value other than undefined, or fails the test with `description` after the timeout. */
export async function waitFor<Value>(
  description: string,
  check: () => Promise<Value | undefined>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Value> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${description}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
