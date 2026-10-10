import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isBlockedEnvPath } from "./block-env-commit.mjs";

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "block-env-commit.mjs");

let repositoryPath;

function git(...args) {
  execFileSync("git", args, { cwd: repositoryPath, stdio: "ignore" });
}

function stageFile(relativePath) {
  const fullPath = join(repositoryPath, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, "SAMPLE=1\n");
  git("add", "--force", relativePath);
}

function runHook() {
  return spawnSync("node", [scriptPath], { cwd: repositoryPath, encoding: "utf8" });
}

beforeEach(() => {
  // A throwaway repository: the real one is never touched.
  repositoryPath = mkdtempSync(join(tmpdir(), "block-env-commit-"));
  git("init", "--quiet");
});

afterEach(() => {
  rmSync(repositoryPath, { recursive: true, force: true });
});

describe("block-env-commit hook", () => {
  it("rejects a staged apps/api/.env and names the file", () => {
    stageFile("apps/api/.env");

    const result = runHook();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/api/.env");
  });

  it("rejects environment-specific files such as .env.production", () => {
    stageFile(".env.production");

    expect(runHook().status).toBe(1);
  });

  it("accepts a staged apps/api/.env.example", () => {
    stageFile("apps/api/.env.example");

    expect(runHook().status).toBe(0);
  });

  it("accepts a staged docs/env-notes.md", () => {
    stageFile("docs/env-notes.md");

    expect(runHook().status).toBe(0);
  });

  it("accepts an empty stage", () => {
    expect(runHook().status).toBe(0);
  });

  it("rejects the commit when a safe file is staged next to an .env file", () => {
    stageFile("docs/env-notes.md");
    stageFile("packages/ids/.env.local");

    const result = runHook();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("packages/ids/.env.local");
    expect(result.stderr).not.toContain("env-notes");
  });
});

describe("isBlockedEnvPath", () => {
  it.each([".env", "apps/api/.env", "apps/api/.env.local"])("blocks %s", (path) => {
    expect(isBlockedEnvPath(path)).toBe(true);
  });

  it.each([".env.example", "apps/api/.env.example", "docs/env-notes.md", "src/.environment.ts"])(
    "allows %s",
    (path) => {
      expect(isBlockedEnvPath(path)).toBe(false);
    },
  );
});
