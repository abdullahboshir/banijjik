import { readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";
import { FIXTURE_EXPECTATIONS } from "./fixture-expectations.js";

const RULE_COUNT = 36;
const currentFolder = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(currentFolder, "fixtures");
const configFile = join(currentFolder, "..", "..", "eslint.config.mjs");
const EXPECTED_RULES = Array.from(
  { length: RULE_COUNT },
  (_, index) => `R${String(index + 1).padStart(2, "0")}`,
);
// Fixtures that cannot carry ".fail." / ".pass." in their name because the rule is about the real file name.
const NAMED_BY_FOLDER =
  /^(r21-star-export\/(fail|pass)\/(index|barrel)|apps\/api\/src\/kernel\/http\/error-handler|apps\/api\/src\/modules\/core\/organization\/index|apps\/api\/src\/modules\/platform\/tenant-admin\/application\/use-cases\/tenant-admin\.use-cases)\.ts$/;
const FIXTURE_FILE = /\.(fail|pass)(\.(test|config))?\.tsx?$/;

type FixtureOutcome = { ruleIds: string[]; messages: string[] };

/** ESLint reports a parse error, and an ignored inline directive, without a rule id. */
function ruleIdOf(message: Linter.LintMessage): string {
  if (message.ruleId !== null) return message.ruleId;
  return message.message.includes("noInlineConfig") ? "inline-config-ignored" : "parse-error";
}

function listFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(folder, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function relativeFixturePath(fullPath: string): string {
  return relative(fixturesRoot, fullPath).split(sep).join("/");
}

function isFixtureFile(path: string): boolean {
  return FIXTURE_FILE.test(path) || NAMED_BY_FOLDER.test(path);
}

function isNamedAsFailing(path: string): boolean {
  return (
    path.includes(".fail.") ||
    path.startsWith("r21-star-export/fail/") ||
    // The probe of finding J3 is a module root file, which cannot be renamed to .fail.ts.
    path === "apps/api/src/modules/core/organization/index.ts"
  );
}

describe("lint rules fire on the fixtures", () => {
  const outcomes = new Map<string, FixtureOutcome>();

  beforeAll(async () => {
    // The fixtures folder acts as the repository root so path-scoped rules see realistic paths.
    const eslint = new ESLint({ cwd: fixturesRoot, overrideConfigFile: configFile });
    const paths = FIXTURE_EXPECTATIONS.map((entry) => join(fixturesRoot, entry.path));
    const results = await eslint.lintFiles(paths);
    for (const result of results) {
      outcomes.set(relativeFixturePath(result.filePath), {
        ruleIds: result.messages.map(ruleIdOf),
        messages: result.messages.map((message) => `${message.ruleId}: ${message.message}`),
      });
    }
  });

  it.each(FIXTURE_EXPECTATIONS)("$rule reports the expected rules for $path", (expectation) => {
    const outcome = outcomes.get(expectation.path);
    expect(outcome, `fixture was not linted: ${expectation.path}`).toBeDefined();
    const reportedRuleIds = [...new Set(outcome?.ruleIds)].sort();
    expect(reportedRuleIds, outcome?.messages.join("\n")).toEqual(
      [...expectation.expectedRuleIds].sort(),
    );
  });
});

describe("the fixture table", () => {
  it("has a failing and a passing fixture for every rule R01 to R36", () => {
    for (const rule of EXPECTED_RULES) {
      const entries = FIXTURE_EXPECTATIONS.filter((entry) => entry.rule === rule);
      expect(
        entries.some((entry) => entry.expectedRuleIds.length > 0),
        `${rule} has no failing fixture`,
      ).toBe(true);
      expect(
        entries.some((entry) => entry.expectedRuleIds.length === 0),
        `${rule} has no passing fixture`,
      ).toBe(true);
    }
  });

  it("lists every fixture file on disk exactly once", () => {
    const onDisk = listFiles(fixturesRoot).map(relativeFixturePath).filter(isFixtureFile);
    const listed = FIXTURE_EXPECTATIONS.map((entry) => entry.path);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...onDisk].sort());
  });

  it("keeps the .fail. naming in step with the expected violations", () => {
    for (const entry of FIXTURE_EXPECTATIONS) {
      const expectsViolation = entry.expectedRuleIds.length > 0;
      expect(isNamedAsFailing(entry.path), entry.path).toBe(expectsViolation);
    }
  });
});
