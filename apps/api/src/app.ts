import { IDEMPOTENCY_REPLAYED_HEADER } from "@banijjik/contracts";
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
  type Readiness,
  REQUEST_ID_HEADER,
  requestIdMiddleware,
  sendData,
} from "./kernel/http/index.js";
import { createAccessLog, setRootLogger } from "./kernel/logger/index.js";
import { MongoRateLimiter, RedisRateLimiter } from "./kernel/rate-limit/index.js";
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
  /** Replaces the dependency check behind GET /ready. Production: the database decides, Redis is reported. */
  readonly checkReadiness?: () => Promise<Readiness>;
  /** Replaces the system clock. Tests move it to expire tokens and rate-limit windows. */
  readonly clock?: Clock;
}

const JSON_BODY_LIMIT = "1mb";

function defaultReadinessCheck(redis: RedisClient | undefined): () => Promise<Readiness> {
  if (redis !== undefined) return createApiReadinessCheck(redis);
  return async () => ({ isReady: await isDatabaseReady() });
}

/** Builds the Express app. Order matters: request id first, error handlers last. */
export function buildApp(options: BuildAppOptions): Express {
  const { config, logger, redis, clock = systemClock } = options;
  const checkReadiness = options.checkReadiness ?? defaultReadinessCheck(redis);
  const v1Router =
    options.v1Router ??
    buildV1Router({
      config,
      clock,
      rateLimiter: new MongoRateLimiter(clock),
      ...(redis === undefined
        ? {}
        : { redis, userRateLimiter: new RedisRateLimiter({ client: redis }) }),
    });
  setRootLogger(logger);
  const app = express();
  app.disable("x-powered-by");
  // Believes only as many X-Forwarded-For entries as there are proxies we run (review M7); 0 ignores the header.
  app.set("trust proxy", config.trustedProxyHops);

  app.use(requestIdMiddleware);
  app.use(createAccessLog(logger));
  // CORS comes before the body parser so body errors (400) still carry the CORS headers.
  app.use(
    cors({
      origin: [...config.corsAllowedOrigins],
      credentials: true,
      // Browser code reads the id from success responses to quote it to support.
      // Retry-After shows the rate-limit wait; Idempotency-Replayed tells a replayed answer.
      exposedHeaders: [REQUEST_ID_HEADER, "Retry-After", IDEMPOTENCY_REPLAYED_HEADER],
    }),
  );
  // Right after CORS, before any body is read: a request from an unknown origin is refused early.
  app.use(createOriginCheck(config.corsAllowedOrigins));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get("/health", (_request, response) => {
    sendData(response, { status: "ok" });
  });
  app.get("/ready", createReadyHandler(checkReadiness));
  app.use("/api/v1", v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
