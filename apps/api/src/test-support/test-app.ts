import { Router, type Express } from "express";
import { buildApp } from "../app.js";
import { createLogger } from "../kernel/logger/index.js";
import { createLogCapture, type LogCapture } from "./log-capture.js";
import { createTestConfig } from "./test-config.js";

export interface TestApp {
  readonly app: Express;
  readonly logs: LogCapture;
}

/** The real app with a test-only router mounted at /api/v1 and its logs captured. */
export function createTestApp(configureRoutes: (router: Router) => void): TestApp {
  const logs = createLogCapture();
  const logger = createLogger({ level: "debug", destination: logs.destination });
  const v1Router = Router();
  configureRoutes(v1Router);
  const app = buildApp({ config: createTestConfig(), logger, v1Router });
  return { app, logs };
}
