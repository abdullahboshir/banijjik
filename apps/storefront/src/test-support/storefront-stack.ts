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

export interface StorefrontStack {
  readonly browser: Browser;
  readonly mongoUri: string;
  readonly stop: () => Promise<void>;
}

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

async function waitForUrl(url: string, label: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isReachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`${label} did not become ready in time`);
}

async function isReachable(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    // The server is still starting; the caller keeps polling until the deadline.
    return false;
  }
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

function startApiProcess(mongoUri: string, role: "api" | "worker"): ChildProcess {
  return spawn(process.execPath, [API_ENTRY], {
    stdio: ["ignore", "ignore", "inherit"],
    env: apiEnvironment(mongoUri, role),
  });
}

function startStorefront(): ChildProcess {
  return spawn(
    process.execPath,
    [requireFromHere.resolve("next/dist/bin/next"), "start", "-p", String(STOREFRONT_PORT)],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "inherit"],
      env: { ...inheritedEnvironment(), STOREFRONT_API_ORIGIN: API_ORIGIN },
    },
  );
}

/** Starts everything a storefront browser test needs and waits until each part answers. */
export async function startStorefrontStack(): Promise<StorefrontStack> {
  const replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const api = startApiProcess(replicaSet.getUri(), "api");
  await waitForUrl(`${API_ORIGIN}/health`, "the API");
  const worker = startApiProcess(replicaSet.getUri(), "worker");
  const storefront = startStorefront();
  await waitForUrl(`${STOREFRONT_ORIGIN}/sign-in`, "the storefront");
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
  return {
    browser,
    mongoUri: replicaSet.getUri(),
    stop: async () => {
      await browser.close();
      storefront.kill();
      worker.kill();
      api.kill();
      await replicaSet.stop();
    },
  };
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
