import { fileURLToPath } from "node:url";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    /** Replica-set URI without a database name, e.g. mongodb://127.0.0.1:41234/?replicaSet=rs0 */
    mongoUri: string;
  }
}

// Matches the `mongo:8` image of infra/docker-compose.yml. Pinned so every machine runs the same server.
const MONGODB_BINARY_VERSION = "8.0.13";
// On the repository drive, shared by every worktree, so the ~300 MB binary is downloaded once.
const BINARY_DOWNLOAD_DIR = fileURLToPath(
  new URL("../../../../node_modules/.cache/mongodb-memory-server", import.meta.url),
);

/** Transactions need a replica set, so tests run against a real single-member one, never a mock. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const replicaSet = await MongoMemoryReplSet.create({
    binary: { version: MONGODB_BINARY_VERSION, downloadDir: BINARY_DOWNLOAD_DIR },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  project.provide("mongoUri", replicaSet.getUri());
  return async () => {
    await replicaSet.stop();
  };
}
