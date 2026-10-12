import { registerEventModels } from "./kernel/events/index.js";
import { registerIdempotencyModel } from "./kernel/idempotency/index.js";
import { registerRateLimitModel } from "./kernel/rate-limit/index.js";
import { registerSequenceModel } from "./kernel/sequence/index.js";
import { registerModuleModels } from "./routes/v1.js";

/**
 * Every model the running API uses, kernel models first. The server and the index sync task
 * both call it, so the index guard and the sync never disagree about which collections exist.
 */
export function registerAllModels(): void {
  registerSequenceModel();
  registerRateLimitModel();
  registerIdempotencyModel();
  registerEventModels();
  registerModuleModels();
}
