import {
  MODULE_CLASS,
  MODULE_KEY,
  SEED_INDUSTRY_TEMPLATE_KEY,
  type ModuleKey,
} from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import type { ModuleRegistry } from "../../../../kernel/modules/index.js";
import { aManifest } from "../../../../test-support/manifest-fixtures.js";
import { OrgConfigResolver } from "./org-config-resolver.js";

const SYSTEM = aManifest(MODULE_KEY.IAM, { moduleClass: MODULE_CLASS.SYSTEM });

function registry(): ModuleRegistry {
  return {
    all: () => [SYSTEM],
    registryHash: "hash",
    find: () => undefined,
    ownerOfRoute: () => undefined,
  } as unknown as ModuleRegistry;
}

describe("OrgConfigResolver sources", () => {
  it("passes the effective module set and never calls OrgConfigReader", async () => {
    const seen: ModuleKey[][] = [];
    let orgConfigCalls = 0;
    const resolver = new OrgConfigResolver({
      registry: registry(),
      subscriptions: { findOpen: async () => undefined },
      packages: { findByIds: async () => [] },
      overrides: { findAll: async () => [] },
      clock: { now: () => new Date("2026-10-15T00:00:00Z") },
      terms: {
        forOrganization: async (_organizationId, templateKey) => {
          seen.push(templateKey === SEED_INDUSTRY_TEMPLATE_KEY.RETAIL ? [MODULE_KEY.IAM] : []);
          return {};
        },
      },
      clientSettings: {
        resolve: async (_organizationId, effectiveModules) => {
          seen.push([...effectiveModules]);
          return {};
        },
      },
      fields: {
        forModules: async (_organizationId, effectiveModules) => {
          seen.push([...effectiveModules]);
          orgConfigCalls += 0;
          return {};
        },
      },
    });

    const resolved = await resolver.resolve({
      organizationId: "org",
      configVersion: 1,
      templateKey: SEED_INDUSTRY_TEMPLATE_KEY.RETAIL,
      template: {
        allowedModuleKeys: [],
        contactRoleKeys: [],
        enabledKinds: [],
        templateVersion: 1,
      },
    });

    expect(resolved.modules).toEqual([MODULE_KEY.IAM]);
    expect(seen[1]).toEqual([MODULE_KEY.IAM]);
    expect(seen[2]).toEqual([MODULE_KEY.IAM]);
    expect(orgConfigCalls).toBe(0);
    expect(Object.keys(resolver)).not.toContain("orgConfig");
  });
});
