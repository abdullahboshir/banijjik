import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

const ENV_FILE_NAME = /^\.env(\..+)?$/;
const ALLOWED_ENV_FILE_NAME = ".env.example";

/** True for ".env", ".env.local", ".env.production" and so on, but not ".env.example". */
export function isBlockedEnvPath(stagedPath) {
  const fileName = basename(stagedPath);
  return ENV_FILE_NAME.test(fileName) && fileName !== ALLOWED_ENV_FILE_NAME;
}

function listStagedPaths() {
  // Deleted files are not filtered here on purpose: removing a committed .env is allowed,
  // so only added, copied, modified and renamed paths are returned.
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    { encoding: "utf8" },
  );
  return output.split("\0").filter(Boolean);
}

function main() {
  const blockedPaths = listStagedPaths().filter(isBlockedEnvPath);
  if (blockedPaths.length === 0) {
    return 0;
  }
  process.stderr.write(
    [
      "Commit blocked: environment files must never be committed.",
      ...blockedPaths.map((blockedPath) => `  - ${blockedPath}`),
      "Unstage them with: git restore --staged <file>. Keep only .env.example in git.",
      "",
    ].join("\n"),
  );
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
