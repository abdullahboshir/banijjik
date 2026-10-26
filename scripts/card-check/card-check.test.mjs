import { describe, expect, it } from "vitest";
import { evaluateCard, formatReport } from "./card-check.mjs";

const HEAD = "5fa5631c9524898c3a6f3d32605821ce6a49ba7c";

function finishedCard(overrides = {}) {
  return {
    branch: "s/M.5-api-credit-purchases",
    headSha: HEAD,
    dirtyPaths: [],
    remoteSha: HEAD,
    isOnLatestMain: true,
    changedPaths: ["apps/api/src/x.ts", "docs/handoffs/M.5-api.md", "docs/STATUS.md"],
    conflictMarkerFiles: [],
    focusedTestLines: [],
    ciRun: { status: "completed", conclusion: "success", url: "https://ci/run/1" },
    ...overrides,
  };
}

function failedCheckNames(facts) {
  return evaluateCard(facts)
    .filter((check) => !check.ok)
    .map((check) => check.name);
}

describe("card-check", () => {
  it("passes a committed, pushed, rebased card with a handoff and a green CI run", () => {
    const facts = finishedCard();

    const report = formatReport(facts, evaluateCard(facts));

    expect(failedCheckNames(facts)).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.text).toContain("card:check PASSED for s/M.5-api-credit-purchases at 5fa5631c");
  });

  it("fails when a fix is left uncommitted in the folder", () => {
    const facts = finishedCard({ dirtyPaths: [" M apps/api/src/booking-context-ports.ts"] });

    expect(failedCheckNames(facts)).toEqual(["everything committed"]);
  });

  it("fails when the last commit is not pushed", () => {
    expect(failedCheckNames(finishedCard({ remoteSha: "2e835e3d0000" }))).toEqual(["pushed"]);
    expect(failedCheckNames(finishedCard({ remoteSha: null }))).toEqual(["pushed"]);
  });

  it("reports a branch behind origin/main as INFO and still passes", () => {
    const facts = finishedCard({ isOnLatestMain: false });

    const report = formatReport(facts, evaluateCard(facts));

    expect(report.passed).toBe(true);
    expect(report.text).toContain("INFO  rebased on origin/main: main moved since your base");
    expect(report.text).not.toContain("FAIL");
  });

  it("fails when CI is red, still running, missing or unreadable", () => {
    const red = { status: "completed", conclusion: "failure", url: "https://ci/run/2" };
    const running = { status: "in_progress", conclusion: "", url: "https://ci/run/3" };

    for (const ciRun of [red, running, null, { error: "gh: not logged in" }]) {
      expect(failedCheckNames(finishedCard({ ciRun }))).toEqual(["CI green on 5fa5631c"]);
    }
  });

  it("accepts the green run of the last code commit when later commits change docs only", () => {
    const codeSha = "2e835e3d9524898c3a6f3d32605821ce6a49ba7c";
    const facts = finishedCard({ ciCommitSha: codeSha });

    const [ciCheck] = evaluateCard(facts).filter((check) => check.name.startsWith("CI green"));

    expect(failedCheckNames(facts)).toEqual([]);
    expect(ciCheck.name).toBe("CI green on 2e835e3d");
    expect(ciCheck.detail).toContain("later commits change docs/ only");
  });

  it("fails when the last code commit has no green run either", () => {
    const codeSha = "2e835e3d9524898c3a6f3d32605821ce6a49ba7c";
    const red = { status: "completed", conclusion: "failure", url: "https://ci/run/4" };

    expect(failedCheckNames(finishedCard({ ciCommitSha: codeSha, ciRun: red }))).toEqual([
      "CI green on 2e835e3d",
    ]);
    expect(failedCheckNames(finishedCard({ ciCommitSha: codeSha, ciRun: null }))).toEqual([
      "CI green on 2e835e3d",
    ]);
  });

  it("does not count a review file as the session's handoff", () => {
    const facts = finishedCard({
      changedPaths: ["docs/handoffs/M.5-api-review-R1.md", "docs/STATUS.md"],
    });

    expect(failedCheckNames(facts)).toEqual(["handoff written"]);
  });

  it("fails on a missing STATUS row, conflict markers, focused tests and a non-card branch", () => {
    const facts = finishedCard({
      branch: "main",
      changedPaths: ["docs/handoffs/M.5-api.md"],
      conflictMarkerFiles: ["docs/STATUS.md"],
      // Built from parts so this file's own diff does not trip the focused-test check.
      focusedTestLines: [`+  it.${"only"}("books a slot", async () => {`],
    });

    const report = formatReport(facts, evaluateCard(facts));

    expect(failedCheckNames(facts)).toEqual([
      "card branch",
      "STATUS row updated",
      "no conflict markers",
      "no focused tests",
    ]);
    expect(report.passed).toBe(false);
    expect(report.text).toContain("card:check FAILED");
  });
});
