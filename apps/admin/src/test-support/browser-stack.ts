import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { IDEMPOTENCY_KEY_HEADER, type MeResponse } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
// The industry template of the seeded business lives in a data file: test code only needs a valid one.
import industryFixture from "./industry-fixture.json" with { type: "json" };
import puppeteer, { type Browser, type CookieParam } from "puppeteer-core";

declare global {
  interface ImportMetaEnv {
    /** Path of the Chrome executable; vitest exposes the process environment here. */
    readonly CHROME_PATH?: string;
  }
}

const requireFromHere = createRequire(import.meta.url);
/** The admin build bakes in http://localhost:4000 as the API address, so the real API must listen there. */
export const API_PORT = 4000;
export const ADMIN_PORT = 3101;
export const ADMIN_ORIGIN = `http://localhost:${ADMIN_PORT}`;
const API_ORIGIN = `http://localhost:${API_PORT}`;
const API_ENTRY = fileURLToPath(new URL("../../../api/dist/main.js", import.meta.url));
const REDIS_URL = "redis://127.0.0.1:6380";
const TEST_ACCESS_TOKEN_SECRET = "browser-test-only-secret-0123456789abcdef";
const READY_TIMEOUT_MS = 40_000;
const POLL_INTERVAL_MS = 250;

export const TEST_PASSWORD = "correct-horse-battery";

export interface BrowserStack {
  browser: Browser;
  /** The replica set URI, for test setup that no API can do yet (a trial close to its end). */
  mongoUri: string;
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

function startApi(mongoUri: string): ChildProcess {
  return spawn(process.execPath, [API_ENTRY], {
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...inheritedEnvironment(),
      NODE_ENV: "development",
      PORT: String(API_PORT),
      ROLE: "api",
      LOG_LEVEL: "warn",
      DB_PLATFORM_URL: withDatabaseName(mongoUri, "browser_platform"),
      DB_TENANT_SHARED_URL: withDatabaseName(mongoUri, "browser_tenant"),
      REDIS_URL,
      CORS_ALLOWED_ORIGINS: ADMIN_ORIGIN,
      AUTH_ACCESS_TOKEN_SECRET: TEST_ACCESS_TOKEN_SECRET,
    },
  });
}

function startAdmin(): ChildProcess {
  return spawn(
    process.execPath,
    [requireFromHere.resolve("next/dist/bin/next"), "start", "-p", String(ADMIN_PORT)],
    { cwd: process.cwd(), stdio: ["ignore", "ignore", "inherit"] },
  );
}

/**
 * The real stack for a browser test: an in-memory MongoDB replica set (the system mongod, nothing is
 * downloaded), the built API on port 4000, the built admin app on port 3101 and headless Chrome.
 */
export async function startBrowserStack(): Promise<BrowserStack> {
  const replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const api = startApi(replicaSet.getUri());
  const admin = startAdmin();
  await waitForUrl(`${API_ORIGIN}/health`, "the API");
  await waitForUrl(`${ADMIN_ORIGIN}/sign-in`, "the admin app");
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
  return {
    browser,
    mongoUri: replicaSet.getUri(),
    stop: async () => {
      await browser.close();
      admin.kill();
      api.kill();
      await replicaSet.stop();
    },
  };
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

async function callApi(
  path: string,
  options: { body: object; cookies?: CookieParam[] },
): Promise<Response> {
  const cookieHeader = (options.cookies ?? []).map((c) => `${c.name}=${c.value}`).join("; ");
  const response = await fetch(`${API_ORIGIN}/api/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ADMIN_ORIGIN,
      [IDEMPOTENCY_KEY_HEADER]: newId(),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(options.body),
  });
  if (!response.ok) throw new Error(`POST ${path} answered ${response.status}`);
  return response;
}

/** Registers a person through the real API and returns their session cookies. */
export async function seedPerson(name: string): Promise<SeededPerson> {
  const email = `person-${newId().slice(-12)}@example.com`;
  const response = await callApi("/auth/register", {
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

/** Creates a business for a seeded person through the real API (the UI cannot do this yet). */
export async function seedOrganization(
  person: SeededPerson,
  slug: string,
  name: string,
): Promise<void> {
  await callApi("/me/orgs", {
    body: { name, slug, ...industryFixture },
    cookies: person.cookies,
  });
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Moves the end of a business's trial to `days` from now, and bumps its config version so the API
 * rebuilds the cached config. Used for the trial banner screenshot: no API changes a trial yet.
 */
export async function setTrialEndsInDays(
  stack: BrowserStack,
  slug: string,
  days: number,
): Promise<void> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const platform = client.db("browser_platform");
    const organization = await platform
      .collection("organizations")
      .findOneAndUpdate({ slug }, { $inc: { configVersion: 1 } });
    if (!organization) throw new Error(`No business with slug ${slug}`);
    await platform
      .collection("platform_subscriptions")
      .updateOne(
        { organizationId: organization["organizationId"] },
        { $set: { trialEndsAt: new Date(Date.now() + days * MILLISECONDS_PER_DAY) } },
      );
  } finally {
    await client.close();
  }
}

/** The organization ID of a seeded person's business, read through the real API. */
async function organizationIdOf(person: SeededPerson, slug: string): Promise<string> {
  const cookieHeader = person.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const response = await fetch(`${API_ORIGIN}/api/v1/me/orgs`, {
    headers: { Cookie: cookieHeader, Origin: ADMIN_ORIGIN },
  });
  if (!response.ok) throw new Error(`GET /me/orgs answered ${response.status}`);
  // Safe: the API answers with the { data: MyOrganizationSummary[] } envelope (14 section 4).
  const body = (await response.json()) as { data: { organizationId: string; slug: string }[] };
  const found = body.data.find((organization) => organization.slug === slug);
  if (!found) throw new Error(`No business with slug ${slug}`);
  return found.organizationId;
}

/** A text custom field the admin can see, in the shape `POST /orgs/{organizationId}/custom-fields` takes. */
export interface SeededTextField {
  entityType: "organization" | "member";
  fieldKey: string;
  label: { bn: string; en: string };
  isSensitive?: boolean;
}

/**
 * Adds organization-level custom fields to a seeded business through the real API, so a browser test can
 * fill them in. The business's own fields are the same kind of field a template brings (ADR-102).
 */
export async function seedCustomFields(
  person: SeededPerson,
  slug: string,
  fields: readonly SeededTextField[],
): Promise<void> {
  const organizationId = await organizationIdOf(person, slug);
  for (const field of fields) {
    await callApi(`/orgs/${organizationId}/custom-fields`, {
      cookies: person.cookies,
      body: {
        ...field,
        fieldType: "TEXT",
        isRequired: false,
        visibility: { admin: true, storefront: false, bot: false },
        botAsk: false,
        isSearchable: false,
        isSensitive: field.isSensitive ?? false,
        sortOrder: 10,
      },
    });
  }
}
