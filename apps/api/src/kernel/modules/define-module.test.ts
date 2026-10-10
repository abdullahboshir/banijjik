import { describe, expect, it } from "vitest";
import { defineModule } from "./define-module.js";
import { ManifestError } from "./manifest-error.js";
import { aManifest } from "../../test-support/manifest-fixtures.js";

describe("defineModule", () => {
  it("returns a deeply frozen copy and leaves the caller object untouched", () => {
    const original = aManifest("workflow", { routes: { admin: ["/orgs/:organizationId/flows"] } });

    const defined = defineModule(original);

    expect(defined).toEqual(original);
    expect(Object.isFrozen(defined)).toBe(true);
    expect(Object.isFrozen(defined.routes.admin)).toBe(true);
    expect(Object.isFrozen(original)).toBe(false);
  });

  it.each([
    ["a key outside the catalogue", { key: "unknown-module" }],
    ["a module path that is not group/module", { path: "workflow" }],
    ["an unknown module class", { moduleClass: "HYBRID" }],
    ["an unknown dependency key", { dependsOn: ["nope"] }],
    ["an unknown offering kind", { providesKinds: ["GADGET"] }],
    ["a route prefix without a leading slash", { routes: { admin: ["roles"] } }],
    ["a route prefix with a trailing slash", { routes: { admin: ["/roles/"] } }],
    ["an unknown limit key", { limitKeys: ["seats"] }],
    ["an unknown event type", { events: { emits: ["made.up"], consumes: [] } }],
    ["an unexpected field", { colour: "red" }],
  ])("refuses %s", (_label, change) => {
    // Safe: the test builds a deliberately invalid manifest to prove the runtime check.
    const broken = { ...aManifest(), ...change } as never;

    expect(() => defineModule(broken)).toThrow(ManifestError);
  });
});
