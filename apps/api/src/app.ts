import cors from "cors";
import express, { type Express, type Router } from "express";
import type { Logger } from "pino";
import type { AppConfig } from "./config/index.js";
import {
  errorHandler,
  notFoundHandler,
  requestIdMiddleware,
  sendData,
} from "./kernel/http/index.js";
import { createAccessLog, setRootLogger } from "./kernel/logger/index.js";
import { buildV1Router } from "./routes/v1.js";

export interface BuildAppOptions {
  readonly config: AppConfig;
  readonly logger: Logger;
  /** Replaces the /api/v1 router. Only tests pass it; production uses buildV1Router(). */
  readonly v1Router?: Router;
}

const JSON_BODY_LIMIT = "1mb";
// One reverse proxy sits in front in production, so its X-Forwarded-For is the client address.
const TRUSTED_PROXY_HOPS = 1;

/** Builds the Express app. Order matters: request id first, error handlers last. */
export function buildApp(options: BuildAppOptions): Express {
  const { config, logger, v1Router = buildV1Router() } = options;
  setRootLogger(logger);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", TRUSTED_PROXY_HOPS);

  app.use(requestIdMiddleware);
  app.use(createAccessLog(logger));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(cors({ origin: [...config.corsAllowedOrigins], credentials: true }));

  app.get("/health", (_request, response) => {
    sendData(response, { status: "ok" });
  });
  app.use("/api/v1", v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
