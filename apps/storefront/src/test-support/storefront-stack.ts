import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import puppeteer, { type Browser } from "puppeteer-core";

declare global {
  interface ImportMetaEnv {
    /** Path of the Chrome executable; vitest exposes the process environment here. */
    readonly CHROME_PATH?: string;
  }
}

/**
 * The real stack for a storefront browser test: an in-memory MongoDB replica set (the system mongod), the
 * built API and its worker on port 4000, the built storefront on port 3102 and headless Chrome. The
 * storefront's business is reached through `<slug>.sites.localhost`, which Chrome resolves to this machine.
 */
const requireFromHere = createRequire(import.meta.url);
export const API_PORT = 4000;
export const STOREFRONT_PORT = 3102;
export const BASE_DOMAIN = "sites.localhost";
export const STOREFRONT_ORIGIN = `http://localhost:${STOREFRONT_PORT}`;
const API_ORIGIN = `http://localhost:${API_PORT}`;
const API_ENTRY = fileURLToPath(new URL("../../../api/dist/main.js", import.meta.url));
const REDIS_URL = "redis://127.0.0.1:6380";
const TEST_ACCESS_TOKEN_SECRET = "browser-test-only-secret-0123456789abcdef";
const READY_TIMEOUT_MS = 40_000;
const POLL_INTERVAL_MS = 250;
/** The last characters of each server's output, shown when a server never becomes ready. */
const OUTPUT_TAIL_CHARACTERS = 4_000;

export interface StorefrontStack {
  readonly browser: Browser;
  readonly mongoUri: string;
  readonly stop: () => Promise<void>;
}

/** A server the stack started: its child process and the tail of what it printed. */
interface ServerProcess {
  readonly label: string;
  readonly child: ChildProcess;
  readonly outputTail: { text: string };
}

/** Something to undo when the stack stops or fails to start. */
type Stop = () => Promise<void>;

function chromePath(): string {
  const path = import.meta.env.CHROME_PATH;
  if (!path) throw new Error("Set CHROME_PATH to a Chrome executable (no browser is downloaded)");
  return path;
}

/** The inherited environment as plain strings, so spawned servers keep PATH and the system variables. */
function inheritedEnvironment(): NodeJS.ProcessEnv {
  const entries = Object.entries(import.meta.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return Object.fromEntries(entries) as NodeJS.ProcessEnv;
}

function withDatabaseName(replicaSetUri: string, databaseName: string): string {
  return replicaSetUri.replace("/?", `/${databaseName}?`);
}

function apiEnvironment(mongoUri: string, role: "api" | "worker"): NodeJS.ProcessEnv {
  return {
    ...inheritedEnvironment(),
    NODE_ENV: "development",
    ROLE: role,
    LOG_LEVEL: "warn",
    DB_PLATFORM_URL: withDatabaseName(mongoUri, "browser_platform"),
    DB_TENANT_SHARED_URL: withDatabaseName(mongoUri, "browser_tenant"),
    REDIS_URL,
    CORS_ALLOWED_ORIGINS: STOREFRONT_ORIGIN,
    AUTH_ACCESS_TOKEN_SECRET: TEST_ACCESS_TOKEN_SECRET,
    STOREFRONT_BASE_DOMAIN: BASE_DOMAIN,
    ...(role === "api" ? { PORT: String(API_PORT) } : {}),
  };
}

/** Starts a server with its output piped, so the tail of it can be shown when the start fails. */
interface ServerSpec {
  readonly label: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env: NodeJS.ProcessEnv;
}

function startServer(spec: ServerSpec): ServerProcess {
  const child = spawn(process.execPath, [...spec.args], {
    cwd: spec.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: spec.env,
  });
  const outputTail = { text: "" };
  const remember = (chunk: Buffer): void => {
    outputTail.text = (outputTail.text + chunk.toString()).slice(-OUTPUT_TAIL_CHARACTERS);
  };
  child.stdout.on("data", remember);
  child.stderr.on("data", remember);
  return { label: spec.label, child, outputTail };
}

function startApiProcess(mongoUri: string, role: "api" | "worker"): ServerProcess {
  return startServer({
    label: `the ${role}`,
    args: [API_ENTRY],
    env: apiEnvironment(mongoUri, role),
  });
}

function startStorefront(): ServerProcess {
  return startServer({
    label: "the storefront",
    args: [requireFromHere.resolve("next/dist/bin/next"), "start", "-p", String(STOREFRONT_PORT)],
    cwd: process.cwd(),
    env: { ...inheritedEnvironment(), STOREFRONT_API_ORIGIN: API_ORIGIN },
  });
}

function isExited(server: ServerProcess): boolean {
  return server.child.exitCode !== null || server.child.signalCode !== null;
}

function startFailure(server: ServerProcess, reason: string): Error {
  const output = server.outputTail.text.trim() || "(no output)";
  return new Error(`${server.label} ${reason}. Its recent output:\n${output}`);
}

async function probe(url: string, isReady: (status: number) => boolean): Promise<boolean> {
  try {
    const response = await fetch(url);
    await response.arrayBuffer();
    return isReady(response.status);
  } catch {
    // The server is still starting; the caller keeps polling until the deadline.
    return false;
  }
}

/** Resolves once the server answers the probe; fails fast when it exits, and carries its output on failure. */
async function waitUntilAnswers(
  server: ServerProcess,
  url: string,
  isReady: (status: number) => boolean,
): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (isExited(server)) throw startFailure(server, "exited before it was ready");
    if (await probe(url, isReady)) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw startFailure(server, `did not answer ${url} within ${READY_TIMEOUT_MS} ms`);
}

function killServer(server: ServerProcess): Stop {
  return () => {
    server.child.kill();
    return Promise.resolve();
  };
}

/** Undoes every started part, newest first. A part that fails to stop does not stop the others from stopping. */
async function runStops(stops: readonly Stop[]): Promise<void> {
  for (const stop of [...stops].reverse()) {
    try {
      await stop();
    } catch {
      // Nothing is left to report to: the start error or the test failure is what matters.
    }
  }
}

/** Starts the whole stack in order, recording how to undo each part as it starts. */
async function bootStack(stops: Stop[]): Promise<StorefrontStack> {
  const replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  stops.push(async () => {
    await replicaSet.stop();
  });
  const api = startApiProcess(replicaSet.getUri(), "api");
  stops.push(killServer(api));
  await waitUntilAnswers(api, `${API_ORIGIN}/health`, (status) => status === 200);
  const worker = startApiProcess(replicaSet.getUri(), "worker");
  stops.push(killServer(worker));
  const storefront = startStorefront();
  stops.push(killServer(storefront));
  // Any answer proves the storefront is serving: a request without a business host gets its 404 page.
  await waitUntilAnswers(storefront, `${STOREFRONT_ORIGIN}/sign-in`, () => true);
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
  stops.push(async () => {
    await browser.close();
  });
  return {
    browser,
    mongoUri: replicaSet.getUri(),
    stop: () => runStops(stops),
  };
}

/**
 * Starts everything a storefront browser test needs and waits until each part answers. When any part fails,
 * the parts already started are stopped before the error is thrown, so a failed start never leaves a process
 * behind (the CI step would wait for it).
 */
export async function startStorefrontStack(): Promise<StorefrontStack> {
  const stops: Stop[] = [];
  try {
    return await bootStack(stops);
  } catch (startError) {
    await runStops(stops);
    throw startError;
  }
}

/** Reads the one-time code the test inbox recorded for a phone number (the SMS driver of development). */
export async function latestSmsCode(stack: StorefrontStack, phoneE164: string): Promise<string> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const messages = client.db("browser_tenant").collection("sms_test_messages");
    const message = await messages.findOne({ phoneE164 }, { sort: { createdAt: -1 } });
    const code = /\b(\d{6})\b/.exec(String(message?.["text"] ?? ""))?.[1];
    if (!code) throw new Error(`No test-inbox code for ${phoneE164}`);
    return code;
  } finally {
    await client.close();
  }
}

export { API_ORIGIN };
