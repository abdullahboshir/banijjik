import { describe, expect, it } from "vitest";
import { isBlockedEnvFileName, isBlockedEnvPath } from "./env-file-name.mjs";

describe("isBlockedEnvFileName", () => {
  it.each([".env", ".ENV", ".Env.local", ".env.", ".env ", ".env. .", ".env.production"])(
    "blocks %j",
    (fileName) => {
      expect(isBlockedEnvFileName(fileName)).toBe(true);
    },
  );

  it.each([".env.example", ".ENV.EXAMPLE", "environment.ts", ".environment.ts", "env.md"])(
    "allows %j",
    (fileName) => {
      expect(isBlockedEnvFileName(fileName)).toBe(false);
    },
  );
});

describe("isBlockedEnvPath", () => {
  it("looks only at the last segment, with either separator", () => {
    expect(isBlockedEnvPath("apps/api/.ENV")).toBe(true);
    expect(isBlockedEnvPath(String.raw`C:\x\.env.local`)).toBe(true);
    expect(isBlockedEnvPath("docs/.env/readme.md")).toBe(false);
  });
});
