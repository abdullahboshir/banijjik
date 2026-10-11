// The API for the platform browser test: the built API of apps/api, started the way main.ts starts it, plus
// ONE probe module in the registry. The production registry holds no OPTIONAL module yet (the first one is
// built in Phase 3), so without a probe an operator could not grant any module in a real browser test. The
// probe has no routes, menu or permissions: it only exists so the entitlement resolver can list it.
// Test code only. It reads the built files in apps/api/dist; build the API first.
import { fileURLToPath } from "node:url";
import { MODULE_CLASS, MODULE_KEY } from "@banijjik/contracts";

const loadFromApi = (path) => import(new URL(`../../../api/dist/${path}`, import.meta.url).href);

const { buildApp } = await loadFromApi("app.js");
const { loadConfigFromProcess } = await loadFromApi("config/index.js");
const { connectDatabases, initializeModels } = await loadFromApi("kernel/db/index.js");
const { registerEventModels } = await loadFromApi("kernel/events/index.js");
const { registerIdempotencyModel } = await loadFromApi("kernel/idempotency/index.js");
const { createLogger, setRootLogger } = await loadFromApi("kernel/logger/index.js");
const { MongoRateLimiter, registerRateLimitModel } = await loadFromApi(
  "kernel/rate-limit/index.js",
);
const { defineModule } = await loadFromApi("kernel/modules/index.js");
const { registerSequenceModel } = await loadFromApi("kernel/sequence/index.js");
const { systemClock } = await loadFromApi("kernel/time/index.js");
const { buildV1Router, registerModuleModels } = await loadFromApi("routes/v1.js");
const { seedPackages } = await loadFromApi("seeds/seed-packages.js");

const PROBE_MODULE_KEY = MODULE_KEY.BOOKKEEPING;

const probeManifest = defineModule({
  key: PROBE_MODULE_KEY,
  path: "commerce/bookkeeping",
  moduleClass: MODULE_CLASS.OPTIONAL,
  tenantCanDisable: false,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  permissions: [],
  menu: [],
  routes: { admin: [] },
  settingKeys: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});

const config = loadConfigFromProcess(fileURLToPath(new URL("./no-env-file", import.meta.url)));
const logger = createLogger({ level: config.logLevel });
setRootLogger(logger);

registerSequenceModel();
registerRateLimitModel();
registerIdempotencyModel();
registerEventModels();
registerModuleModels();
await connectDatabases(config);
await initializeModels();
await seedPackages(systemClock);

const v1Router = buildV1Router({
  config,
  clock: systemClock,
  rateLimiter: new MongoRateLimiter(systemClock),
  extraManifests: [probeManifest],
});
buildApp({ config, logger, v1Router }).listen(config.port);
