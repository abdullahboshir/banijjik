import { AsyncLocalStorage } from "node:async_hooks";
import type { SystemReason } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { getLogger } from "../logger/logger.js";
import { findRequestContext, runWithRequestContext } from "./request-context.js";

// Kept out of RequestContext on purpose: a context is built by anyone who can call
// runWithRequestContext, but this mark may only be set here (review finding J5b).
const systemReasonStorage = new AsyncLocalStorage<SystemReason>();

/** The reason of the surrounding runAsSystem, or undefined in normal tenant-scoped code. The tenant plugin (card 1.3) reads it. */
export function getSystemReason(): SystemReason | undefined {
  return systemReasonStorage.getStore();
}

/**
 * The only way to skip tenant filtering (05-CONVENTIONS "System access"). Runs `work` with the
 * reason marked and logs the access first, so every bypass leaves a trace.
 * The tenant plugin (card 1.3) honours the reason; lint rules R26 and R27 keep it out of module code.
 */
export async function runAsSystem<Result>(
  reason: SystemReason,
  work: () => Promise<Result>,
): Promise<Result> {
  // Outside a request (a job, a seed script) there is no id yet, so the access gets its own.
  const context = findRequestContext() ?? { requestId: newId() };
  return runWithRequestContext(context, () =>
    systemReasonStorage.run(reason, async () => {
      getLogger().info({ event: "system_access", reason }, "system access");
      return work();
    }),
  );
}
