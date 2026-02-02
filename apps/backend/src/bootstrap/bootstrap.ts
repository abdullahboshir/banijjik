// bootstrap/index.ts

import { loadConfig } from "./config-loader";
import { bootstrapConfig } from "./config.bootstrap";
import { bootstrapDatabase } from "./database.bootstrap";
import { bootstrapDI } from "./di.bootstrap";
import { bootstrapEvents } from "./events.bootstrap";
import { bootstrapModules } from "./modules.bootstrap";
import { bootstrapServer } from "./server.bootstrap.js";
import { Express } from "express";
import { appConfig } from "../config/app.config";
import { runAllSeeders } from "../domains/core/iam/infrastructure/persistence/mongoose/seeds/run.seeder";

export async function bootstrapApp(app: Express) {
  try {
    console.log("🚀 Bootstrapping application...");

    await loadConfig();
    await bootstrapConfig();
    await bootstrapDatabase();

    // Automate seeding in development
    if (appConfig.NODE_ENV === "development") {
      await runAllSeeders();
    }

    await bootstrapDI();
    await bootstrapEvents();
    await bootstrapModules();
    await bootstrapServer(app);

    console.log("✅ Application Ready");
    return app;
  } catch (err) {
    console.error("🔥 Bootstrap failed", err);
    process.exit(1);
  }
}
