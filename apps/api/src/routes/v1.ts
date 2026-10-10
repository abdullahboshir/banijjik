import { Router } from "express";

/**
 * The only place that mounts module routers and global middleware (AGENTS.md).
 * Nothing is mounted yet: auth arrives in 1.1, tenant context in 1.3.
 */
export function buildV1Router(): Router {
  return Router();
}
