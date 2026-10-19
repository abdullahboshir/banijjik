import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import * as prettier from "prettier";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { generateModule, NewModuleError, runCommandLine } from "./new-module.mjs";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONTRACTS_SOURCE = join(REPOSITORY_ROOT, "packages", "contracts", "src");
const KERNEL_MODULES = join(REPOSITORY_ROOT, "apps", "api", "src", "kernel", "modules");
const MODULES_IN_TREE = join("apps", "api", "src", "modules");
const WORKFLOW = { target: "automation/workflow" };
const PAYMENT_GATEWAY = { target: "integration/payment-gateway", moduleClass: "CORE" };

let treeRoot;

function copyKernelModules(targetFolder) {
  mkdirSync(targetFolder, { recursive: true });
  for (const name of readdirSync(KERNEL_MODULES)) {
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      copyFileSync(join(KERNEL_MODULES, name), join(targetFolder, name));
    }
  }
}

function copyContractFile(name) {
  const folder = join(treeRoot, "packages", "contracts", "src", "modules");
  mkdirSync(folder, { recursive: true });
  copyFileSync(join(CONTRACTS_SOURCE, "modules", name), join(folder, name));
}

/**
 * The smallest tree the generator and the checks need: the two contract files the generator reads,
 * the kernel module registry the generated code imports, and a tsconfig that reads the contracts
 * from source (the build output may not exist when the tool tests run alone). It lives inside the
 * repository's node_modules so the packages the generated code imports still resolve.
 */
function buildTree() {
  treeRoot = join(REPOSITORY_ROOT, "node_modules", ".cache", `new-module-test-${process.pid}`);
  rmSync(treeRoot, { recursive: true, force: true });
  copyContractFile("module-key.ts");
  copyContractFile("module-class.ts");
  copyKernelModules(join(treeRoot, "apps", "api", "src", "kernel", "modules"));
  const contractsEntry = join(CONTRACTS_SOURCE, "index.ts");
  // The `file` and `contact` entries of the package (cards 3.0, 3.1a) must resolve before the root
  // alias, which matches by prefix.
  const fileEntry = join(CONTRACTS_SOURCE, "file", "index.ts");
  const contactEntry = join(CONTRACTS_SOURCE, "contact", "index.ts");
  const catalogEntry = join(CONTRACTS_SOURCE, "catalog", "index.ts");
  const iamEntry = join(CONTRACTS_SOURCE, "iam", "index.ts");
  const accountingEntry = join(CONTRACTS_SOURCE, "accounting", "index.ts");
  const pricingEntry = join(CONTRACTS_SOURCE, "pricing", "index.ts");
  const directoryEntry = join(CONTRACTS_SOURCE, "directory", "index.ts");
  writeFileSync(
    join(treeRoot, "tsconfig.json"),
    JSON.stringify({
      extends: join(REPOSITORY_ROOT, "packages", "config", "tsconfig.base.json"),
      compilerOptions: {
        noEmit: true,
        lib: ["ES2022"],
        types: ["node"],
        paths: {
          "@banijjik/contracts/file": [fileEntry],
          "@banijjik/contracts/contact": [contactEntry],
          "@banijjik/contracts/catalog": [catalogEntry],
          "@banijjik/contracts/iam": [iamEntry],
          "@banijjik/contracts/accounting": [accountingEntry],
          "@banijjik/contracts/pricing": [pricingEntry],
          "@banijjik/contracts/directory": [directoryEntry],
          "@banijjik/contracts": [contractsEntry],
        },
      },
      include: ["apps/**/*.ts"],
    }),
  );
  writeFileSync(
    join(treeRoot, "vitest.config.mjs"),
    `export default { resolve: { alias: { "@banijjik/contracts/file": ${JSON.stringify(fileEntry)}, "@banijjik/contracts/contact": ${JSON.stringify(contactEntry)}, "@banijjik/contracts/catalog": ${JSON.stringify(catalogEntry)}, "@banijjik/contracts/iam": ${JSON.stringify(iamEntry)}, "@banijjik/contracts/accounting": ${JSON.stringify(accountingEntry)}, "@banijjik/contracts/pricing": ${JSON.stringify(pricingEntry)}, "@banijjik/contracts/directory": ${JSON.stringify(directoryEntry)}, "@banijjik/contracts": ${JSON.stringify(contractsEntry)} } } };\n`,
  );
}

function generate(options) {
  return generateModule({ repositoryRoot: treeRoot, ...options });
}

function typeCheckTree() {
  const host = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined };
  const parsed = ts.getParsedCommandLineOfConfigFile(join(treeRoot, "tsconfig.json"), {}, host);
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    return `${diagnostic.file?.fileName ?? "(global)"}: ${message}`;
  });
}

async function lintFiles(files) {
  // CI makes typescript-eslint build its project once, so it misses files this helper has just written.
  const eslint = new ESLint({
    cwd: treeRoot,
    overrideConfigFile: join(REPOSITORY_ROOT, "eslint.config.mjs"),
    overrideConfig: {
      languageOptions: { parserOptions: { disallowAutomaticSingleRunInference: true } },
    },
  });
  const results = await eslint.lintFiles(files);
  return results.flatMap((result) =>
    result.messages.map(
      (message) =>
        `${relative(treeRoot, result.filePath)}:${message.line} ${message.ruleId}: ${message.message}`,
    ),
  );
}

async function findUnformatted(files) {
  const unformatted = [];
  for (const file of files) {
    const options = (await prettier.resolveConfig(file)) ?? {};
    const isFormatted = await prettier.check(readFileSync(file, "utf8"), {
      ...options,
      filepath: file,
    });
    if (!isFormatted) unformatted.push(relative(treeRoot, file));
  }
  return unformatted;
}

function runGeneratedTests(folder) {
  const vitestEntry = join(REPOSITORY_ROOT, "node_modules", "vitest", "vitest.mjs");
  return spawnSync(
    process.execPath,
    [
      vitestEntry,
      "run",
      "--config",
      join(treeRoot, "vitest.config.mjs"),
      "--root",
      treeRoot,
      folder,
    ],
    { encoding: "utf8" },
  );
}

beforeAll(buildTree);
afterAll(() => rmSync(treeRoot, { recursive: true, force: true }));

describe("npm run new-module", () => {
  const generated = {};

  beforeAll(async () => {
    generated.workflow = await generate(WORKFLOW);
    generated.paymentGateway = await generate(PAYMENT_GATEWAY);
  });

  it("writes the four layers, index, manifest, README and a first test, with no empty folder", () => {
    const names = generated.workflow.createdFiles
      .map((file) => relative(generated.workflow.moduleFolder, file).split("\\").join("/"))
      .sort();

    expect(names).toEqual([
      "README.md",
      "application/ports/workflow-info.source.ts",
      "application/use-cases/get-workflow-info.use-case.ts",
      "domain/errors.ts",
      "index.ts",
      "infrastructure/manifest-workflow-info.source.ts",
      "module.manifest.ts",
      "presentation/workflow-info.transformer.ts",
      "workflow.manifest.test.ts",
    ]);
    expect(
      names.every((name) => readFileSync(join(generated.workflow.moduleFolder, name)).length > 0),
    ).toBe(true);
  });

  it("declares the key, path and class in a manifest made by defineModule", () => {
    const manifest = readFileSync(
      join(generated.paymentGateway.moduleFolder, "module.manifest.ts"),
      "utf8",
    );

    expect(manifest).toContain("export const paymentGatewayManifest = defineModule({");
    expect(manifest).toContain("key: MODULE_KEY.PAYMENT_GATEWAY");
    expect(manifest).toContain('path: "integration/payment-gateway"');
    expect(manifest).toContain("moduleClass: MODULE_CLASS.CORE");
  });

  it("defaults to the OPTIONAL class", () => {
    const manifest = readFileSync(
      join(generated.workflow.moduleFolder, "module.manifest.ts"),
      "utf8",
    );

    expect(manifest).toContain("moduleClass: MODULE_CLASS.OPTIONAL");
  });

  it("keeps the README within 30 lines", () => {
    const readme = readFileSync(join(generated.workflow.moduleFolder, "README.md"), "utf8");

    expect(readme.trimEnd().split("\n").length).toBeLessThanOrEqual(30);
  });

  it("prints the wiring steps the person still has to do", () => {
    expect(generated.workflow.nextSteps.join("\n")).toContain("MODULE_MANIFESTS");
    expect(generated.workflow.nextSteps.join("\n")).toContain("registerWorkflowModels()");
  });

  it("makes files that pass every lint rule", async () => {
    const files = [...generated.workflow.createdFiles, ...generated.paymentGateway.createdFiles];

    const findings = await lintFiles(files.filter((file) => file.endsWith(".ts")));

    expect(findings).toEqual([]);
  });

  it("makes files that type-check", () => {
    expect(typeCheckTree()).toEqual([]);
  });

  it("makes files that are already formatted", async () => {
    const files = [...generated.workflow.createdFiles, ...generated.paymentGateway.createdFiles];

    expect(await findUnformatted(files)).toEqual([]);
  });

  it("makes a first test that passes unchanged", () => {
    const run = runGeneratedTests(generated.paymentGateway.moduleFolder);

    expect(run.stdout + run.stderr).toContain("2 passed");
    expect(run.status).toBe(0);
  });
});

describe("the checks themselves", () => {
  it("report a file that breaks a lint rule and a file that does not type-check", async () => {
    const badFile = join(treeRoot, MODULES_IN_TREE, "core", "broken-probe", "domain", "broken.ts");
    mkdirSync(dirname(badFile), { recursive: true });
    writeFileSync(badFile, "export const value: number = console.log('x') as string;\n");

    const lintFindings = await lintFiles([badFile]);
    const typeFindings = typeCheckTree();

    expect(lintFindings.join("\n")).toContain("no-console");
    expect(typeFindings.join("\n")).toContain("broken.ts");
    rmSync(dirname(dirname(badFile)), { recursive: true, force: true });
  });
});

describe("the refusals", () => {
  it("refuses a key that is not in MODULE_KEY and says where to add it", async () => {
    await expect(generate({ target: "core/not-a-real-module" })).rejects.toThrow(
      "add the module key to @banijjik/contracts first",
    );
  });

  it("refuses an unknown group", async () => {
    await expect(generate({ target: "backoffice/audit" })).rejects.toThrow(
      /unknown group "backoffice"/,
    );
  });

  it("refuses a key that is not kebab-case", async () => {
    await expect(generate({ target: "core/Audit" })).rejects.toThrow(/kebab-case/);
  });

  it("refuses an argument that is not group/key", async () => {
    await expect(generate({ target: "audit" })).rejects.toThrow(/usage/);
    await expect(generate({})).rejects.toThrow(/usage/);
  });

  it("refuses an unknown class", async () => {
    await expect(generate({ target: "core/audit", moduleClass: "HEROIC" })).rejects.toThrow(
      /unknown class/,
    );
  });

  it("refuses to overwrite a folder, in the same group or in another", async () => {
    await generate({ target: "core/audit" });
    const files = readdirSync(join(treeRoot, MODULES_IN_TREE, "core", "audit"));

    await expect(generate({ target: "core/audit" })).rejects.toThrow(/already has a folder/);
    await expect(generate({ target: "platform/audit" })).rejects.toThrow(/already has a folder/);
    expect(readdirSync(join(treeRoot, MODULES_IN_TREE, "core", "audit"))).toEqual(files);
  });

  it("is a NewModuleError, which the command line turns into exit code 1 and a message", async () => {
    const printed = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const exitCode = await runCommandLine(["core/not-a-real-module", "--root", treeRoot]);

    expect(exitCode).toBe(1);
    expect(printed).toHaveBeenCalledWith(expect.stringContaining("new-module:"));
    await expect(generate({ target: "x" })).rejects.toBeInstanceOf(NewModuleError);
    printed.mockRestore();
  });
});

describe("the real tree", () => {
  it("is never written to by these tests", async () => {
    const realModules = join(REPOSITORY_ROOT, MODULES_IN_TREE);

    expect(existsSync(join(realModules, "automation", "workflow"))).toBe(false);
    expect(existsSync(join(realModules, "integration", "payment-gateway"))).toBe(false);
  });
});
