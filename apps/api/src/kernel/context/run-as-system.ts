import type { SystemReason } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { getLogger } from "../logger/logger.js";
import {
  findRequestContext,
  runWithRequestContext,
  type RequestContext,
} from "./request-context.js";

function buildSystemContext(reason: SystemReason): RequestContext {
  // Outside a request (a job, a seed script) there is no id yet, so the access gets its own.
  const base = findRequestContext() ?? { requestId: newId() };
  return { ...base, systemReason: reason };
}

/**
 * The only way to skip tenant filtering (05-CONVENTIONS "System access"). Runs `work` in a child
 * context carrying the reason and logs the access first, so every bypass leaves a trace.
 * The tenant plugin (card 1.3) honours the reason; lint rule R26 keeps it out of module code.
 */
export async function runAsSystem<Result>(
  reason: SystemReason,
  work: () => Promise<Result>,
): Promise<Result> {
  return runWithRequestContext(buildSystemContext(reason), async () => {
    getLogger().info({ event: "system_access", reason }, "system access");
    return work();
  });
}
