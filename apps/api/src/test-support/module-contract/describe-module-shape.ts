import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ModuleManifest } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";

export const MAX_README_LINES = 30;
const REQUIRED_FILES = ["index.ts", "module.manifest.ts", "README.md"];
const MANIFEST_EXPORT =
  /export\s*\{[^}]*\b\w+Manifest\b[^}]*\}\s*from\s*"\.\/module\.manifest\.js"/;

export interface ModuleShapeOptions {
  /** `apps/api/src/modules`, where a manifest's `path` (`core/audit`) is a folder. */
  readonly modulesRoot: string;
  readonly manifests: readonly ModuleManifest[];
}

/** The files of the module template that a folder lacks (docs/05-CONVENTIONS.md "Module README", card 1.6b). */
export function findMissingFiles(folder: string): string[] {
  return REQUIRED_FILES.filter((name) => !existsSync(join(folder, name)));
}

export function exportsItsManifest(folder: string): boolean {
  return MANIFEST_EXPORT.test(readFileSync(join(folder, "index.ts"), "utf8"));
}

export function readmeLineCount(folder: string): number {
  return readFileSync(join(folder, "README.md"), "utf8").trimEnd().split("\n").length;
}

function describeFolder(modulesRoot: string, manifest: ModuleManifest): void {
  const folder = join(modulesRoot, manifest.path);
  describe(manifest.path, () => {
    it("has index.ts, module.manifest.ts and README.md", () => {
      expect(findMissingFiles(folder)).toEqual([]);
    });

    it("exports its manifest from index.ts", () => {
      expect(exportsItsManifest(folder)).toBe(true);
    });

    it(`keeps the README within ${MAX_README_LINES} lines`, () => {
      expect(readmeLineCount(folder)).toBeLessThanOrEqual(MAX_README_LINES);
    });
  });
}

/** A module that drifts from the template shape fails here (card 1.6b, decision 9). */
export function describeModuleShape(options: ModuleShapeOptions): void {
  describe("module shape", () => {
    for (const manifest of options.manifests) describeFolder(options.modulesRoot, manifest);
  });
}
