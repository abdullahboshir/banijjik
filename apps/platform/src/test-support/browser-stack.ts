import { spawn, spawnSync, type ChildProcess, type SpawnSyncReturns } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { IDEMPOTENCY_KEY_HEADER, type MeResponse } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import puppeteer, { type Browser, type CookieParam } from "puppeteer-core";
import industryFixture from "./industry-fixture.json" with { type: "json" };

declare global {
  interface ImportMetaEnv {
    /** Path of the Chrome executable; vitest exposes the process environment here. */
    readonly CHROME_PATH?: string;
  }
}

const requireFromHere = createRequire(import.meta.url);
/** The builds bake in http://localhost:4000 as the API address, so the real API must listen there. */
export const API_PORT = 4000;
/** Distinct from the admin app's own browser tests (3101), so the two suites never fight for a port. */
export const ADMIN_PORT = 3102;
export const PLATFORM_PORT = 3201;
export const API_ORIGIN = `http://localhost:${API_PORT}`;
export const ADMIN_ORIGIN = `http://localhost:${ADMIN_PORT}`;
export const PLATFORM_ORIGIN = `http://localhost:${PLATFORM_PORT}`;
const PROBE_API_ENTRY = fileURLToPath(new URL("./probe-api.mjs", import.meta.url));
const API_FOLDER = fileURLToPath(new URL("../../../api", import.meta.url));
const ADMIN_FOLDER = fileURLToPath(new URL("../../../admin", import.meta.url));
const REDIS_URL = "redis://127.0.0.1:6380";
const TEST_ACCESS_TOKEN_SECRET = "browser-test-only-secret-0123456789abcdef";
const READY_TIMEOUT_MS = 40_000;
const POLL_INTERVAL_MS = 250;
const SEED_ATTEMPTS = 3;
const PORT_WAIT_MS = 600_000;
const PORT_POLL_MS = 5_000;

export const TEST_PASSWORD = "correct-horse-battery";
export const OPERATOR_EMAIL = "operator@example.com";
export const OPERATOR_PASSWORD = "operator-horse-battery-1";
/** The module the probe API registers (see probe-api.mjs); the only one an operator can grant in this stack. */
export const PROBE_MODULE_KEY = "bookkeeping";

export interface BrowserStack {
  browser: Browser;
  stop: () => Promise<void>;
}

export interface SeededPerson {
  email: string;
  password: string;
  name: string;
  /** The session cookies the API issued, ready to be set in a browser page. */
  cookies: CookieParam[];
}

function chromePath(): string {
  const path = import.meta.env.CHROME_PATH;
  if (!path) throw new Error("Set CHROME_PATH to a Chrome executable (no browser is downloaded)");
  return path;
}

/** The inherited environment as plain strings, so spawned servers keep PATH and the Windows system variables. */
function inheritedEnvironment(): Record<string, string> {
  const entries = Object.entries(import.meta.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return Object.fromEntries(entries);
}

async function waitForUrl(url: string, label: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still starting; the deadline ends the wait.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`${label} did not become ready in time`);
}

function withDatabaseName(replicaSetUri: string, databaseName: string): string {
  return replicaSetUri.replace("/?", `/${databaseName}?`);
}

function apiEnvironment(mongoUri: string): NodeJS.ProcessEnv {
  return {
    ...inheritedEnvironment(),
    NODE_ENV: "development",
    PORT: String(API_PORT),
    ROLE: "api",
    LOG_LEVEL: "warn",
    DB_PLATFORM_URL: withDatabaseName(mongoUri, "browser_platform"),
    DB_TENANT_SHARED_URL: withDatabaseName(mongoUri, "browser_tenant"),
    REDIS_URL,
    CORS_ALLOWED_ORIGINS: `${ADMIN_ORIGIN},${PLATFORM_ORIGIN}`,
    AUTH_ACCESS_TOKEN_SECRET: TEST_ACCESS_TOKEN_SECRET,
  };
}

/**
 * Another suite (or a leftover server) may hold the fixed API port. Starting anyway would let this test talk to
 * a foreign API, so it waits for the port to be free and fails when it stays busy.
 */
async function waitForFreePort(port: number): Promise<void> {
  const deadline = Date.now() + PORT_WAIT_MS;
  while (Date.now() < deadline) {
    if (await isPortFree(port)) return;
    await new Promise((resolve) => setTimeout(resolve, PORT_POLL_MS));
  }
  throw new Error(
    `Port ${port} stayed busy: stop the process that holds it and run the test again`,
  );
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

/**
 * Creates the platform super admin with the existing seed script, which uses the seed use case. The script
 * is safe to run again, and on a loaded machine its first connection can time out, so it gets a few tries.
 */
function seedOperator(mongoUri: string): void {
  let lastOutput = "";
  for (let attempt = 1; attempt <= SEED_ATTEMPTS; attempt += 1) {
    const result = runSeedScript(mongoUri);
    if (result.status === 0) return;
    lastOutput = `${result.stdout}${result.stderr}`;
  }
  throw new Error(`The platform admin seed failed: ${lastOutput}`);
}

function runSeedScript(mongoUri: string): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    [requireFromHere.resolve("tsx/cli"), "src/seeds/run-seed-platform-admin.ts"],
    {
      cwd: API_FOLDER,
      encoding: "utf8",
      env: {
        ...apiEnvironment(mongoUri),
        PLATFORM_ADMIN_EMAIL: OPERATOR_EMAIL,
        PLATFORM_ADMIN_PASSWORD: OPERATOR_PASSWORD,
      },
    },
  );
}

function startNext(folder: string, port: number): ChildProcess {
  return spawn(
    process.execPath,
    [requireFromHere.resolve("next/dist/bin/next"), "start", "-p", String(port)],
    { cwd: folder, stdio: ["ignore", "ignore", "inherit"] },
  );
}

/**
 * The real stack for the platform browser test: an in-memory MongoDB replica set (the system mongod, nothing
 * is downloaded), the built API with one probe module on port 4000, the seeded platform super admin, the built
 * admin app on 3102 (a tenant member signs in there), the built platform app on 3201, and headless Chrome.
 * Both apps must be built first (`npm run build`).
 */
export async function startBrowserStack(): Promise<BrowserStack> {
  await Promise.all([API_PORT, ADMIN_PORT, PLATFORM_PORT].map(waitForFreePort));
  const replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const servers: ChildProcess[] = [];
  const stopServers = (): void => servers.forEach((server) => server.kill());
  try {
    const browser = await launchStack(replicaSet.getUri(), servers);
    return {
      browser,
      stop: async () => {
        await browser.close();
        stopServers();
        await replicaSet.stop();
      },
    };
  } catch (error) {
    stopServers();
    await replicaSet.stop();
    throw error;
  }
}

/** Starts the servers in order, each recorded in `servers` so a failure can stop them, then the browser. */
async function launchStack(mongoUri: string, servers: ChildProcess[]): Promise<Browser> {
  servers.push(
    spawn(process.execPath, [PROBE_API_ENTRY], {
      stdio: ["ignore", "ignore", "inherit"],
      env: apiEnvironment(mongoUri),
    }),
  );
  await waitForUrl(`${API_ORIGIN}/health`, "the API");
  seedOperator(mongoUri);
  servers.push(startNext(ADMIN_FOLDER, ADMIN_PORT), startNext(process.cwd(), PLATFORM_PORT));
  await waitForUrl(`${ADMIN_ORIGIN}/sign-in`, "the admin app");
  await waitForUrl(`${PLATFORM_ORIGIN}/sign-in`, "the platform app");
  return puppeteer.launch({ executablePath: chromePath(), headless: true });
}

function toCookieParam(setCookie: string): CookieParam {
  const [pair = "", ...attributes] = setCookie.split(";").map((part) => part.trim());
  const separator = pair.indexOf("=");
  const path = attributes.find((attribute) => attribute.toLowerCase().startsWith("path="));
  return {
    name: pair.slice(0, separator),
    value: pair.slice(separator + 1),
    domain: "localhost",
    path: path ? path.slice("path=".length) : "/",
    httpOnly: true,
  };
}

function cookieHeaderOf(cookies: CookieParam[]): Record<string, string> {
  const header = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  return header ? { Cookie: header } : {};
}

async function callApi(
  path: string,
  options: { method: "GET" | "POST"; body?: object; cookies?: CookieParam[] },
): Promise<Response> {
  const response = await fetch(`${API_ORIGIN}/api/v1${path}`, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      Origin: ADMIN_ORIGIN,
      [IDEMPOTENCY_KEY_HEADER]: newId(),
      ...cookieHeaderOf(options.cookies ?? []),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  if (!response.ok) throw new Error(`${options.method} ${path} answered ${response.status}`);
  return response;
}

/** Registers a person through the real API and returns their session cookies. */
export async function seedPerson(name: string): Promise<SeededPerson> {
  const email = `person-${newId().slice(-12)}@example.com`;
  const response = await callApi("/auth/register", {
    method: "POST",
    body: { name, email, password: TEST_PASSWORD, preferredLocale: "bn" },
  });
  // Safe: the API answers register with the { data: MeResponse } envelope (14 section 4).
  const me = ((await response.json()) as { data: MeResponse }).data;
  return {
    email,
    password: TEST_PASSWORD,
    name: me.name,
    cookies: response.headers.getSetCookie().map(toCookieParam),
  };
}

/** Creates a business for a seeded person through the real API and returns its organization id. */
export async function seedOrganization(
  person: SeededPerson,
  slug: string,
  name: string,
): Promise<string> {
  const response = await callApi("/me/orgs", {
    method: "POST",
    body: { name, slug, ...industryFixture },
    cookies: person.cookies,
  });
  // Safe: the API answers with the { data: { organizationId } } envelope.
  return ((await response.json()) as { data: { organizationId: string } }).data.organizationId;
}

/** The module keys that the config of a business lists, as its own member sees them (`GET /me/config`). */
export async function effectiveModulesOf(
  person: SeededPerson,
  organizationId: string,
): Promise<string[]> {
  const response = await callApi(`/orgs/${organizationId}/me/config`, {
    method: "GET",
    cookies: person.cookies,
  });
  // Safe: the API answers with the { data: ResolvedOrgConfigResponse } envelope; only `modules` is read.
  const config = ((await response.json()) as { data: { modules: string[] } }).data;
  return config.modules;
}
