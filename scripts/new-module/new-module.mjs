import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// npm run new-module -- <group>/<module-key> [--class CORE|OPTIONAL|SYSTEM|PLATFORM]
// Creates a module that starts in the same shape as every other (10-MODULE-CATALOG section 11,
// docs/05-CONVENTIONS.md "Module README"). The module key must already be in @banijjik/contracts.

const SCRIPT_FOLDER = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_FOLDER = join(SCRIPT_FOLDER, "templates");
const DEFAULT_REPOSITORY_ROOT = resolve(SCRIPT_FOLDER, "..", "..");
const DEFAULT_MODULE_CLASS = "OPTIONAL";
// The folders of 10-MODULE-CATALOG section 4.
const MODULE_GROUPS = [
  "core",
  "commerce",
  "channel",
  "integration",
  "automation",
  "capability",
  "platform",
];
const KEBAB_CASE = /^[a-z]+(-[a-z]+)*$/;
const TEMPLATE_SUFFIX = ".template";
const MODULE_KEY_FILE = ["packages", "contracts", "src", "modules", "module-key.ts"];
const MODULE_CLASS_FILE = ["packages", "contracts", "src", "modules", "module-class.ts"];
const MODULES_FOLDER = ["apps", "api", "src", "modules"];

/** A refusal the person can fix; the command line prints its message and exits with 1. */
export class NewModuleError extends Error {}

/** The `NAME: "value"` pairs of the MODULE_KEY object, read from the contracts source (single source of truth). */
function readModuleKeys(repositoryRoot) {
  const source = readFileSync(join(repositoryRoot, ...MODULE_KEY_FILE), "utf8");
  const pairs = [...source.matchAll(/^\s+([A-Z_]+): "([a-z-]+)",$/gm)];
  return new Map(pairs.map(([, constantName, key]) => [key, constantName]));
}

function readModuleClasses(repositoryRoot) {
  const source = readFileSync(join(repositoryRoot, ...MODULE_CLASS_FILE), "utf8");
  const list = /defineEnum\(\[([^\]]*)\]/.exec(source)?.[1] ?? "";
  return [...list.matchAll(/"([A-Z]+)"/g)].map(([, value]) => value);
}

function splitTarget(target) {
  const parts = (target ?? "").split("/");
  if (parts.length !== 2 || parts.some((part) => part === "")) {
    throw new NewModuleError("usage: npm run new-module -- <group>/<module-key>");
  }
  return { group: parts[0], key: parts[1] };
}

function assertGroupAndKey({ group, key }, moduleKeys) {
  if (!MODULE_GROUPS.includes(group)) {
    throw new NewModuleError(`unknown group "${group}"; use one of ${MODULE_GROUPS.join(", ")}`);
  }
  if (!KEBAB_CASE.test(key)) {
    throw new NewModuleError(`the module key "${key}" must be kebab-case`);
  }
  if (!moduleKeys.has(key)) {
    throw new NewModuleError(
      `"${key}" is not a MODULE_KEY value: add the module key to @banijjik/contracts first`,
    );
  }
}

function assertClass(moduleClass, repositoryRoot) {
  const classes = readModuleClasses(repositoryRoot);
  if (!classes.includes(moduleClass)) {
    throw new NewModuleError(`unknown class "${moduleClass}"; use one of ${classes.join(", ")}`);
  }
}

/** One folder per module key: a key already built under another group is refused too. */
function findExistingFolder(modulesRoot, key) {
  if (!existsSync(modulesRoot)) return undefined;
  const groups = readdirSync(modulesRoot, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );
  const match = groups.find((group) => existsSync(join(modulesRoot, group.name, key)));
  return match === undefined ? undefined : join(modulesRoot, match.name, key);
}

function toPascalCase(key) {
  return key
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

function buildReplacements({ group, key }, constantName, moduleClass) {
  const pascal = toPascalCase(key);
  return {
    group,
    key,
    constantName,
    moduleClass,
    pascal,
    camel: pascal.charAt(0).toLowerCase() + pascal.slice(1),
  };
}

function render(text, replacements) {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, name) => {
    if (!(name in replacements)) throw new Error(`template placeholder {{${name}}} has no value`);
    return replacements[name];
  });
}

function listTemplateFiles(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(folder, entry.name);
    return entry.isDirectory() ? listTemplateFiles(fullPath) : [fullPath];
  });
}

function writeTemplates(moduleFolder, replacements) {
  const createdFiles = [];
  for (const templatePath of listTemplateFiles(TEMPLATE_FOLDER)) {
    const relativePath = relative(TEMPLATE_FOLDER, templatePath).slice(0, -TEMPLATE_SUFFIX.length);
    const targetPath = join(moduleFolder, render(relativePath, replacements));
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, render(readFileSync(templatePath, "utf8"), replacements));
    createdFiles.push(targetPath);
  }
  return createdFiles;
}

function describeNextSteps({ key }, replacements) {
  return [
    `Next steps for ${key}:`,
    "  1. Add its permission keys to @banijjik/contracts, then list them in the manifest.",
    `  2. Add ${replacements.camel}Manifest to MODULE_MANIFESTS in apps/api/src/routes/module-registry.ts.`,
    `  3. Call register${replacements.pascal}Models() in registerModuleModels() in apps/api/src/routes/v1.ts.`,
    "  4. Add the default role grant row in apps/api/src/modules/core/iam/domain/system-role-grants.ts.",
    "  5. Write the first real use case and its tests, then replace the README purpose line.",
  ];
}

/** Templates are written for short keys; Prettier (a root dev dependency) wraps the lines of long ones. */
async function formatFiles(files) {
  const prettier = await import("prettier");
  for (const file of files) {
    const options = (await prettier.resolveConfig(file)) ?? {};
    const text = readFileSync(file, "utf8");
    writeFileSync(file, await prettier.format(text, { ...options, filepath: file }));
  }
}

/**
 * Creates the module folder and returns what it wrote. Refuses (NewModuleError) a bad argument, an
 * unknown group, a key that is not in MODULE_KEY and a key that already has a folder.
 */
export async function generateModule(options) {
  const repositoryRoot = options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT;
  const moduleClass = options.moduleClass ?? DEFAULT_MODULE_CLASS;
  const target = splitTarget(options.target);
  const moduleKeys = readModuleKeys(repositoryRoot);
  assertGroupAndKey(target, moduleKeys);
  assertClass(moduleClass, repositoryRoot);
  const modulesRoot = join(repositoryRoot, ...MODULES_FOLDER);
  const existingFolder = findExistingFolder(modulesRoot, target.key);
  if (existingFolder !== undefined) {
    throw new NewModuleError(`${target.key} already has a folder: ${existingFolder}`);
  }
  const replacements = buildReplacements(target, moduleKeys.get(target.key), moduleClass);
  const moduleFolder = join(modulesRoot, target.group, target.key);
  const createdFiles = writeTemplates(moduleFolder, replacements);
  await formatFiles(createdFiles);
  return {
    moduleFolder,
    createdFiles,
    nextSteps: describeNextSteps(target, replacements),
  };
}

function readFlag(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new NewModuleError(`${flag} needs a value`);
  }
  return value;
}

function firstPositional(argv) {
  const flagValues = new Set(["--class", "--root"].map((flag) => argv.indexOf(flag) + 1));
  return argv.find((argument, index) => !argument.startsWith("--") && !flagValues.has(index));
}

export async function runCommandLine(argv) {
  try {
    const result = await generateModule({
      target: firstPositional(argv),
      moduleClass: readFlag(argv, "--class"),
      repositoryRoot: readFlag(argv, "--root"),
    });
    const root = readFlag(argv, "--root") ?? DEFAULT_REPOSITORY_ROOT;
    console.log(
      `Created ${result.createdFiles.length} files in ${relative(root, result.moduleFolder)}${sep}`,
    );
    for (const line of result.nextSteps) console.log(line);
    return 0;
  } catch (error) {
    if (!(error instanceof NewModuleError)) throw error;
    console.error(`new-module: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCommandLine(process.argv.slice(2));
}
