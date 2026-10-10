import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MODULE_CLASS, MODULE_KEY } from "@banijjik/contracts";
import { Router } from "express";
import { afterAll, describe, expect, it } from "vitest";
import { createModuleRegistry, defineModule } from "../../kernel/modules/index.js";
import {
  exportsItsManifest,
  findMissingFiles,
  MAX_README_LINES,
  readmeLineCount,
} from "./describe-module-shape.js";
import { listTenantRoutes } from "./mounted-routes.js";

// The registry-wide checks must be able to fail, or a green run proves nothing.

const temporaryFolders: string[] = [];

afterAll(() => {
  for (const folder of temporaryFolders) rmSync(folder, { recursive: true, force: true });
});

function buildModuleFolder(files: Record<string, string>): string {
  const folder = mkdtempSync(join(tmpdir(), "module-shape-"));
  temporaryFolders.push(folder);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, name), text);
  }
  return folder;
}

describe("the module shape checks", () => {
  it("name the template files a module folder lacks", () => {
    const folder = buildModuleFolder({ "index.ts": "export {};\n" });

    expect(findMissingFiles(folder)).toEqual(["module.manifest.ts", "README.md"]);
  });

  it("see whether index.ts exports the manifest", () => {
    const exporting = buildModuleFolder({
      "index.ts": 'export { workflowManifest } from "./module.manifest.js";\n',
    });
    const forgetful = buildModuleFolder({ "index.ts": 'export { other } from "./other.js";\n' });

    expect(exportsItsManifest(exporting)).toBe(true);
    expect(exportsItsManifest(forgetful)).toBe(false);
  });

  it("count a README that has outgrown its limit", () => {
    const folder = buildModuleFolder({ "README.md": "line\n".repeat(MAX_README_LINES + 1) });

    expect(readmeLineCount(folder)).toBeGreaterThan(MAX_README_LINES);
  });
});

describe("the mounted route walk", () => {
  function buildV1Router(): Router {
    const moduleRouter = Router({ mergeParams: true });
    moduleRouter.get("/owned", () => undefined);
    moduleRouter.get("/forgotten", () => undefined);
    moduleRouter.use(
      "/nested",
      Router({ mergeParams: true }).get("/inside", () => undefined),
    );
    const tenantRouter = Router({ mergeParams: true });
    tenantRouter.use(moduleRouter);
    const v1Router = Router();
    v1Router.get("/auth/login", () => undefined);
    v1Router.use("/orgs/:organizationId", (_request, _response, next) => next(), tenantRouter);
    return v1Router;
  }

  it("lists only the routes behind the tenant mount, with their full paths", () => {
    const { paths } = listTenantRoutes(buildV1Router());

    expect(paths).toEqual(["/orgs/:organizationId/owned", "/orgs/:organizationId/forgotten"]);
  });

  it("reports a router mounted on a path inside a module router instead of guessing", () => {
    expect(listTenantRoutes(buildV1Router()).unreadableMounts).toBe(1);
  });

  it("lets a registry tell the owned route from the forgotten one", () => {
    const registry = createModuleRegistry([
      defineModule({
        key: MODULE_KEY.WORKFLOW,
        path: "capability/workflow",
        moduleClass: MODULE_CLASS.OPTIONAL,
        dependsOn: [],
        providesKinds: [],
        requiresAnyKind: [],
        tenantCanDisable: false,
        permissions: [],
        routes: { admin: ["/orgs/:organizationId/owned"] },
        menu: [],
        settingKeys: [],
        customFieldEntities: [],
        botTools: [],
        storefrontSections: [],
        events: { emits: [], consumes: [] },
        limitKeys: [],
        sequenceKeys: [],
      }),
    ]);

    const unowned = listTenantRoutes(buildV1Router()).paths.filter(
      (path) => registry.ownerOfRoute(path) === undefined,
    );

    expect(unowned).toEqual(["/orgs/:organizationId/forgotten"]);
  });
});
