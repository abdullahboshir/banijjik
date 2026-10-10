import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ENV_FILE_NAME = /^\.env(\..+)?$/;
const ALLOWED_ENV_FILE_NAME = ".env.example";
const BLOCK_EXIT_CODE = 2;
const BLOCK_MESSAGE =
  "Blocked: .env files must be edited by the owner, never by an agent. Use .env.example for documentation.";

/** True for ".env", ".env.local", ".env.production" and so on, but not ".env.example". */
export function isBlockedEnvPath(filePath) {
  // Windows paths use backslashes, and path.basename on Linux would not split them.
  const fileName = filePath.split(/[\\/]/).pop() ?? "";
  return ENV_FILE_NAME.test(fileName) && fileName !== ALLOWED_ENV_FILE_NAME;
}

/** Returns the file path a tool call targets, or undefined when the input is unusable. */
export function extractTargetPath(rawInput) {
  let parsedInput;
  try {
    parsedInput = JSON.parse(rawInput);
  } catch {
    // Malformed input must never break other tools: the hook allows the call.
    return undefined;
  }
  const toolInput = parsedInput?.tool_input;
  const candidatePath = toolInput?.file_path ?? toolInput?.notebook_path;
  return typeof candidatePath === "string" ? candidatePath : undefined;
}

function readStandardInput() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    // No readable stdin (for example a closed pipe): treated as empty, so the call is allowed.
    return "";
  }
}

function main() {
  const targetPath = extractTargetPath(readStandardInput());
  if (targetPath === undefined || !isBlockedEnvPath(targetPath)) {
    return 0;
  }
  process.stderr.write(`${BLOCK_MESSAGE}\n`);
  return BLOCK_EXIT_CODE;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
