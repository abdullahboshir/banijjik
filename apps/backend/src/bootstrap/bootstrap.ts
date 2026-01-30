// bootstrap/index.ts

import { loadConfig } from "./config-loader";
import { bootstrapConfig } from "./config.bootstrap";
import { bootstrapDatabase } from "./database.bootstrap";
import { bootstrapDI } from "./di.bootstrap";
import { bootstrapEvents } from "./events.bootstrap";
import { bootstrapModules } from "./modules.bootstrap";
import { bootstrapServer } from "./server.bootstrap";

export async function bootstrapApp() {
  try {
    console.log("🚀 Bootstrapping application...");

    await loadConfig();
    await bootstrapConfig();
    await bootstrapDatabase();
    await bootstrapDI();
    await bootstrapEvents();
    await bootstrapModules();
    await bootstrapServer();

    console.log("✅ Application Ready");
  } catch (err) {
    console.error("🔥 Bootstrap failed", err);
    process.exit(1);
  }
}
