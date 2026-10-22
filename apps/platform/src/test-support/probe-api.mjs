// The API for the platform browser test: the built API of apps/api, started the way main.ts starts it.
// The production registry now holds OPTIONAL modules, so an operator can grant a real one.
// Test code only. It reads the built files in apps/api/dist; build the API first.
import { fileURLToPath } from "node:url";

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
const { registerSequenceModel } = await loadFromApi("kernel/sequence/index.js");
const { systemClock } = await loadFromApi("kernel/time/index.js");
const { buildV1Router, registerModuleModels } = await loadFromApi("routes/v1.js");
const { seedIndustryTemplates } = await loadFromApi("seeds/seed-industry-templates.js");
const { seedPackages } = await loadFromApi("seeds/seed-packages.js");

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
await seedIndustryTemplates(systemClock);

const v1Router = buildV1Router({
  config,
  clock: systemClock,
  rateLimiter: new MongoRateLimiter(systemClock),
});
buildApp({ config, logger, v1Router }).listen(config.port);
