import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractTargetPath, isBlockedEnvPath } from "./claude-block-env.mjs";

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "claude-block-env.mjs");

function runHook(stdin) {
  return spawnSync("node", [scriptPath], { input: stdin, encoding: "utf8" });
}

function toolCall(toolName, toolInput) {
  return JSON.stringify({ tool_name: toolName, tool_input: toolInput });
}

describe("claude-block-env hook", () => {
  it.each([
    ["Edit", { file_path: "apps/api/.env" }],
    ["Write", { file_path: ".env.local" }],
    ["Write", { file_path: "C:\\x\\.env.production" }],
    ["NotebookEdit", { notebook_path: "notebooks/.env" }],
    ["Edit", { file_path: "apps/api/.ENV" }],
    ["Write", { file_path: "apps/api/.Env.local" }],
    ["Write", { file_path: "apps/api/.env." }],
    ["Write", { file_path: "apps/api/.env " }],
  ])("blocks %s on %j with exit code 2 and the reason", (toolName, toolInput) => {
    const result = runHook(toolCall(toolName, toolInput));

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Blocked: .env files must be edited by the owner");
  });

  it.each(["apps/api/.env.example", "docs/env.md", "src/environment.ts"])(
    "allows an edit of %s silently",
    (filePath) => {
      const result = runHook(toolCall("Edit", { file_path: filePath }));

      expect(result.status).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
    },
  );

  it.each([
    ["empty stdin", ""],
    ["malformed JSON", "{not json"],
    ["a call without a path", toolCall("Edit", {})],
    ["JSON null", "null"],
    ["a non-string path", toolCall("Edit", { file_path: 42 })],
  ])("allows %s so it never breaks other tools", (_label, stdin) => {
    expect(runHook(stdin).status).toBe(0);
  });
});

describe("isBlockedEnvPath", () => {
  it.each([".env", "apps/api/.env", "C:\\x\\.env.production"])("blocks %s", (path) => {
    expect(isBlockedEnvPath(path)).toBe(true);
  });

  it.each([".env.example", "C:\\x\\.env.example", "docs/env.md", "src/.environment.ts"])(
    "allows %s",
    (path) => {
      expect(isBlockedEnvPath(path)).toBe(false);
    },
  );
});

describe("extractTargetPath", () => {
  it("prefers file_path and falls back to notebook_path", () => {
    expect(extractTargetPath(toolCall("Edit", { file_path: "a.ts" }))).toBe("a.ts");
    expect(extractTargetPath(toolCall("NotebookEdit", { notebook_path: "b.ipynb" }))).toBe(
      "b.ipynb",
    );
  });
});
