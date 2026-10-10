import cors from "cors";
import express, { type Express, type Router } from "express";
import type { Logger } from "pino";
import type { AppConfig } from "./config/index.js";
import { isDatabaseReady } from "./kernel/db/index.js";
import {
  createOriginCheck,
  createReadyHandler,
  errorHandler,
  notFoundHandler,
  REQUEST_ID_HEADER,
  requestIdMiddleware,
  sendData,
} from "./kernel/http/index.js";
import { createAccessLog, setRootLogger } from "./kernel/logger/index.js";
import { MongoRateLimiter } from "./kernel/rate-limit/index.js";
import { createApiReadinessCheck, type RedisClient } from "./kernel/redis/index.js";
import { systemClock, type Clock } from "./kernel/time/index.js";
import { buildV1Router } from "./routes/v1.js";

export interface BuildAppOptions {
  readonly config: AppConfig;
  readonly logger: Logger;
  /** Replaces the /api/v1 router. Only tests pass it; production uses buildV1Router(). */
  readonly v1Router?: Router;
  /** The API role passes its Redis client: the permission cache uses it and /ready pings it. */
  readonly redis?: RedisClient;
  /** Replaces the dependency check behind GET /ready. Production checks the database and Redis. */
  readonly isReady?: () => Promise<boolean>;
  /** Replaces the system clock. Tests move it to expire tokens and rate-limit windows. */
  readonly clock?: Clock;
}

const JSON_BODY_LIMIT = "1mb";
// One reverse proxy sits in front in production, so its X-Forwarded-For is the client address.
const TRUSTED_PROXY_HOPS = 1;

/** Builds the Express app. Order matters: request id first, error handlers last. */
export function buildApp(options: BuildAppOptions): Express {
  const { config, logger, redis, clock = systemClock } = options;
  const isReady =
    options.isReady ?? (redis === undefined ? isDatabaseReady : createApiReadinessCheck(redis));
  const v1Router =
    options.v1Router ??
    buildV1Router({
      config,
      clock,
      rateLimiter: new MongoRateLimiter(clock),
      ...(redis === undefined ? {} : { redis }),
    });
  setRootLogger(logger);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", TRUSTED_PROXY_HOPS);

  app.use(requestIdMiddleware);
  app.use(createAccessLog(logger));
  // CORS comes before the body parser so body errors (400) still carry the CORS headers.
  app.use(
    cors({
      origin: [...config.corsAllowedOrigins],
      credentials: true,
      // Browser code reads the id from success responses to quote it to support.
      exposedHeaders: [REQUEST_ID_HEADER],
    }),
  );
  // Right after CORS, before any body is read: a request from an unknown origin is refused early.
  app.use(createOriginCheck(config.corsAllowedOrigins));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get("/health", (_request, response) => {
    sendData(response, { status: "ok" });
  });
  app.get("/ready", createReadyHandler(isReady));
  app.use("/api/v1", v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
