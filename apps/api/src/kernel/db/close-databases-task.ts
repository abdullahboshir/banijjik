import type { ShutdownTask } from "../lifecycle/shutdown.js";
import type { DatabaseConnections } from "./database-connections.js";

/** Runs after the HTTP server closes, so requests in flight finish before their connection goes away. */
export function createCloseDatabasesTask(connections: DatabaseConnections): ShutdownTask {
  return { name: "close-databases", run: () => connections.close() };
}
