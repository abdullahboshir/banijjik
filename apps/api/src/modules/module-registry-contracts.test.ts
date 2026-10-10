import { fileURLToPath } from "node:url";
import { MongoRateLimiter } from "../kernel/rate-limit/index.js";
import { systemClock } from "../kernel/time/index.js";
import { MODULE_MANIFESTS } from "../routes/module-registry.js";
import { buildV1Router } from "../routes/v1.js";
import { describeModuleShape } from "../test-support/module-contract/describe-module-shape.js";
import { describeRegistryContracts } from "../test-support/module-contract/describe-registry-contracts.js";
import { createTestConfig } from "../test-support/test-config.js";
import { SEED_PACKAGES } from "./platform/package/index.js";

// Registry-wide rules of 10-MODULE-CATALOG section 11 over the manifests the application really
// ships, and the template shape of every module folder. A module joins both by joining the list.
describeRegistryContracts({
  manifests: MODULE_MANIFESTS,
  basePackages: SEED_PACKAGES.filter((entry) => !entry.isAddOn),
  v1Router: () =>
    buildV1Router({
      config: createTestConfig(),
      clock: systemClock,
      rateLimiter: new MongoRateLimiter(systemClock),
    }),
});

describeModuleShape({
  modulesRoot: fileURLToPath(new URL("./", import.meta.url)),
  manifests: MODULE_MANIFESTS,
});
