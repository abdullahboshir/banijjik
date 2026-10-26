import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Finish gate for a card session (parallel-sessions guide §8). Sessions have claimed "done" with
// uncommitted fixes, unpushed commits and red CI; this prints facts read from git and GitHub,
// so a "done" report carries proof instead of a claim.

const CARD_BRANCH_PREFIX = "s/";
const BASE_BRANCH = "origin/main";
const HANDOFF_PATH = /^docs\/handoffs\/(?!.*-review-R\d+\.md$).+\.md$/;
// Extended regex for git grep: a line that starts with seven < or > and then a space or its end.
const CONFLICT_MARKER = "^(<{7}|>{7})( |$)";
const FOCUSED_TEST = /\b(it|describe|test)\.only\(/;
const SCRIPT_SOURCE = /\.(ts|tsx|mjs|js)$/;
// CI skips pushes that change only this folder (ci.yml paths-ignore, card 3.44).
const DOCS_ONLY_PATHSPEC = ":(exclude)docs";

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryRun(command, args) {
  try {
    return { ok: true, output: run(command, args) };
  } catch (error) {
    return { ok: false, output: String(error?.stderr ?? error?.message ?? error).trim() };
  }
}

function readLatestPushRun(branch, headSha) {
  const result = tryRun("gh", [
    "run",
    "list",
    "--branch",
    branch,
    "--commit",
    headSha,
    "--event",
    "push",
    "--limit",
    "1",
    "--json",
    "status,conclusion,url",
  ]);
  if (!result.ok) return { error: result.output };
  const [latest] = JSON.parse(result.output);
  return latest ?? null;
}

/**
 * The CI run that proves the code at HEAD: the run of HEAD itself, or, when HEAD was a docs-only
 * push that CI skipped, the run of the last commit that changed anything outside docs/.
 */
function readCiRunForCode(branch, headSha) {
  const headRun = readLatestPushRun(branch, headSha);
  if (headRun !== null) return { ciCommitSha: headSha, ciRun: headRun };
  const lastCode = tryRun("git", [
    "log",
    "-1",
    "--format=%H",
    "HEAD",
    "--",
    ".",
    DOCS_ONLY_PATHSPEC,
  ]);
  if (!lastCode.ok || lastCode.output === "" || lastCode.output === headSha) {
    return { ciCommitSha: headSha, ciRun: null };
  }
  return { ciCommitSha: lastCode.output, ciRun: readLatestPushRun(branch, lastCode.output) };
}

function addedLinesWithFocusedTests(changedPaths) {
  const sources = changedPaths.filter((path) => SCRIPT_SOURCE.test(path));
  if (sources.length === 0) return [];
  const diff = run("git", ["diff", "-U0", `${BASE_BRANCH}...HEAD`, "--", ...sources]);
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++") && FOCUSED_TEST.test(line));
}

/** Reads every fact the gate needs from git and gh. Network: one fetch and one or two gh calls. */
export function collectFacts() {
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  tryRun("git", ["fetch", "--quiet", "origin"]);
  const headSha = run("git", ["rev-parse", "HEAD"]);
  const remoteSha = tryRun("git", ["rev-parse", `origin/${branch}`]);
  const changedPaths = run("git", ["diff", "--name-only", `${BASE_BRANCH}...HEAD`])
    .split("\n")
    .filter(Boolean);
  const markerFiles = tryRun("git", ["grep", "-l", "-I", "-E", CONFLICT_MARKER]);
  return {
    branch,
    headSha,
    dirtyPaths: run("git", ["status", "--porcelain"]).split("\n").filter(Boolean),
    remoteSha: remoteSha.ok ? remoteSha.output : null,
    isOnLatestMain: tryRun("git", ["merge-base", "--is-ancestor", BASE_BRANCH, "HEAD"]).ok,
    changedPaths,
    conflictMarkerFiles: markerFiles.ok ? markerFiles.output.split("\n").filter(Boolean) : [],
    focusedTestLines: addedLinesWithFocusedTests(changedPaths),
    ...readCiRunForCode(branch, headSha),
  };
}

function describeCiRun(ciRun) {
  if (ciRun === null)
    return { ok: false, detail: "no CI run for this commit yet: push, then wait" };
  if (ciRun.error) return { ok: false, detail: `gh failed: ${ciRun.error}` };
  if (ciRun.status !== "completed")
    return { ok: false, detail: `still ${ciRun.status}: ${ciRun.url}` };
  return { ok: ciRun.conclusion === "success", detail: `${ciRun.conclusion}: ${ciRun.url}` };
}

function describeCiCheck(facts) {
  const ciCommitSha = facts.ciCommitSha ?? facts.headSha;
  const { ok, detail } = describeCiRun(facts.ciRun);
  const provenByEarlierCommit = ciCommitSha !== facts.headSha;
  return {
    name: `CI green on ${ciCommitSha.slice(0, 8)}`,
    ok,
    detail: provenByEarlierCommit
      ? `${detail} (last code commit; later commits change docs/ only)`
      : detail,
  };
}

/** Pure: turns the facts into named checks, so the rules are testable without git. */
export function evaluateCard(facts) {
  const shortSha = facts.headSha.slice(0, 8);
  return [
    {
      name: "card branch",
      ok: facts.branch.startsWith(CARD_BRANCH_PREFIX),
      detail: facts.branch,
    },
    {
      name: "everything committed",
      ok: facts.dirtyPaths.length === 0,
      detail: facts.dirtyPaths.length === 0 ? "clean" : facts.dirtyPaths.join(", "),
    },
    {
      name: "pushed",
      ok: facts.remoteSha === facts.headSha,
      detail: `local ${shortSha}, origin ${facts.remoteSha?.slice(0, 8) ?? "missing"}`,
    },
    {
      name: "rebased on origin/main",
      ok: facts.isOnLatestMain,
      detail: facts.isOnLatestMain
        ? "yes"
        : "origin/main is not an ancestor: git rebase origin/main",
    },
    {
      name: "handoff written",
      ok: facts.changedPaths.some((path) => HANDOFF_PATH.test(path)),
      detail: "a docs/handoffs/<card>-<api|ui>.md changed on this branch",
    },
    {
      name: "STATUS row updated",
      ok: facts.changedPaths.includes("docs/STATUS.md"),
      detail: "docs/STATUS.md changed on this branch",
    },
    {
      name: "no conflict markers",
      ok: facts.conflictMarkerFiles.length === 0,
      detail: facts.conflictMarkerFiles.join(", ") || "none",
    },
    {
      name: "no focused tests",
      ok: facts.focusedTestLines.length === 0,
      detail: facts.focusedTestLines.join(" | ") || "none",
    },
    describeCiCheck(facts),
  ];
}

export function formatReport(facts, checks) {
  const passed = checks.every((check) => check.ok);
  const lines = checks.map(
    (check) => `${check.ok ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`,
  );
  const verdict = passed
    ? `card:check PASSED for ${facts.branch} at ${facts.headSha.slice(0, 8)}`
    : "card:check FAILED: the card is not done. Fix every FAIL line and run it again.";
  return { passed, text: [...lines, verdict, ""].join("\n") };
}

function main() {
  const facts = collectFacts();
  const report = formatReport(facts, evaluateCard(facts));
  process.stdout.write(report.text);
  return report.passed ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
