import { getDatabaseConnections } from "./database-connections.js";

const DEFAULT_PING_TIMEOUT_MS = 2000;
const CONNECTED_STATE = 1;

function timeoutAfter(milliseconds: number): { promise: Promise<false>; cancel(): void } {
  let timer: NodeJS.Timeout | undefined;
  const promise = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), milliseconds);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

async function pingPlatform(): Promise<boolean> {
  const { platform } = getDatabaseConnections();
  if (platform.readyState !== CONNECTED_STATE || platform.db === undefined) return false;
  await platform.db.admin().ping();
  return true;
}

/**
 * True when the platform database answers a ping in time. Any failure, including no connection, is false.
 * `probe` is replaceable so the timeout and failure paths can be tested without a broken server.
 */
export async function isDatabaseReady(
  timeoutMs = DEFAULT_PING_TIMEOUT_MS,
  probe: () => Promise<boolean> = pingPlatform,
): Promise<boolean> {
  const timeout = timeoutAfter(timeoutMs);
  try {
    return await Promise.race([probe(), timeout.promise]);
  } catch {
    // Not-ready is the answer here; the probe has no use for the cause (the caller logs the outcome).
    return false;
  } finally {
    timeout.cancel();
  }
}
