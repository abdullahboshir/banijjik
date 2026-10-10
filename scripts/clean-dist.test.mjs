import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanDist } from "./clean-dist.mjs";

let packageFolder;

beforeEach(() => {
  packageFolder = mkdtempSync(join(tmpdir(), "clean-dist-"));
});

afterEach(() => {
  rmSync(packageFolder, { recursive: true, force: true });
});

describe("cleanDist", () => {
  it("removes dist with its nested files and leaves other folders alone", () => {
    mkdirSync(join(packageFolder, "dist", "nested"), { recursive: true });
    writeFileSync(join(packageFolder, "dist", "nested", "old.test.js"), "");
    mkdirSync(join(packageFolder, "src"));
    writeFileSync(join(packageFolder, "src", "index.ts"), "");

    cleanDist(packageFolder);

    expect(existsSync(join(packageFolder, "dist"))).toBe(false);
    expect(existsSync(join(packageFolder, "src", "index.ts"))).toBe(true);
  });

  it("does nothing when there is no dist folder", () => {
    expect(() => cleanDist(packageFolder)).not.toThrow();
  });
});
