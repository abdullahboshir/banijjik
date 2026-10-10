import { PERMISSION_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { createPermissionMiddleware } from "../../../../kernel/access/index.js";
import { runWithRequestContext } from "../../../../kernel/context/index.js";
import { MutableClock } from "../../../../test-support/mutable-clock.js";
import { organizationManifest } from "../../organization/index.js";
import { Role } from "../domain/role.entity.js";
import { iamManifest } from "../index.js";
import { InMemoryPermissionCache } from "./in-memory-permission-cache.js";
import { buildPermissionCatalog } from "../application/permission-catalog.js";
import { IamPermissionGate } from "../application/permission-gate.js";
import { PermissionResolver } from "../application/permission-resolver.js";

const CHECKS = 1000;
const P95_LIMIT_MILLISECONDS = 5;
const PERCENTILE_95 = 0.95;
const PERCENTILE_50 = 0.5;

function percentile(sortedMilliseconds: readonly number[], fraction: number): number {
  const index = Math.min(
    sortedMilliseconds.length - 1,
    Math.floor(sortedMilliseconds.length * fraction),
  );
  return sortedMilliseconds[index] ?? 0;
}

describe("permission check benchmark (card 1.4: p95 < 5 ms on a cache hit)", () => {
  it("answers 1000 cache-hit checks, middleware and gate included, with p95 under 5 ms", async () => {
    const catalog = buildPermissionCatalog([iamManifest, organizationManifest]);
    const organizationId = newId<OrganizationId>();
    const manager = Role.createSystem({
      organizationId,
      roleKey: SYSTEM_ROLE_KEY.MANAGER,
      createdByUserId: newId<UserId>(),
      now: new Date(),
    });
    const gate = new IamPermissionGate({
      catalog,
      resolver: new PermissionResolver(catalog),
      cache: new InMemoryPermissionCache({ clock: new MutableClock() }),
      roles: { findByIds: async () => [manager] },
      members: { findAssignments: async () => [{ locationId: "ALL", roleId: manager.roleId }] },
    });
    const check = createPermissionMiddleware(gate)(PERMISSION_KEY.IAM_ROLE_READ);
    // Safe: the middleware reads only request.query; no response method is called on a granted check.
    const request = { query: {} } as Request;
    const response = {} as Response;
    const context = {
      requestId: "benchmark",
      organizationId,
      memberId: "member-1",
      accessVersion: "1.1",
      allowedLocationIds: "ALL" as const,
    };
    const timings: number[] = [];

    await runWithRequestContext(context, async () => {
      // The first call fills the cache; only hits are measured.
      await check(request, response, () => undefined);
      for (let attempt = 0; attempt < CHECKS; attempt += 1) {
        const started = performance.now();
        await check(request, response, () => undefined);
        timings.push(performance.now() - started);
      }
    });

    timings.sort((first, second) => first - second);
    const p50 = percentile(timings, PERCENTILE_50);
    const p95 = percentile(timings, PERCENTILE_95);
    process.stdout.write(
      `permission check, ${CHECKS} cache hits: p50 ${p50.toFixed(4)} ms, p95 ${p95.toFixed(4)} ms\n`,
    );
    expect(p95).toBeLessThan(P95_LIMIT_MILLISECONDS);
  });
});
