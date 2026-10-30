import { ERROR_CODE, MODULE_KEY, MODULE_OVERRIDE_EFFECT } from "@banijjik/contracts";
import {
  GUEST_SESSION_ABSOLUTE_EXPIRY_DAYS,
  SF_GUEST_COOKIE_NAME,
  WEBSITE_GUEST_CHECKOUT_SETTING_KEY,
  formatGuestCookie,
  parseGuestCookie,
} from "@banijjik/contracts/website";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { models } from "../../../kernel/db/index.js";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { writeModuleOverride } from "../../../test-support/entitlement-world.js";
import { registerIamApiModels } from "../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { callStorefront } from "../../../test-support/storefront-world.js";
import { freshIp, parseSetCookies } from "../../../test-support/auth-api-client.js";
import { hashGuestSecret } from "./application/use-cases/resolve-guest-session.use-case.js";
import {
  GUEST_SESSION_MODEL_NAME,
  type GuestSessionDocument,
} from "./infrastructure/guest-session.schema.js";
import { newId } from "@banijjik/ids";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

function sessionModel() {
  return models({}).get<GuestSessionDocument>(GUEST_SESSION_MODEL_NAME);
}

interface SettingValueDoc {
  settingValueId: string;
  organizationId: string;
  settingKey: string;
  locationId: string | null;
  value: unknown;
  version: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

function settingModel() {
  return models({}).get<SettingValueDoc>("SettingValue");
}

describe("storefront guest session", () => {
  it("creates guest session with 32-byte opaque secret in httpOnly sf_guest cookie", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/guest-session",
      body: {},
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("guestSessionId");
    expect(response.body.data).toHaveProperty("expiresAt");

    const cookies = parseSetCookies(response);
    const guestCookie = cookies.find((c) => c.name === SF_GUEST_COOKIE_NAME);
    expect(guestCookie).toBeDefined();
    expect(guestCookie?.attributes.some((a) => a.toLowerCase() === "httponly")).toBe(true);

    const parsed = parseGuestCookie(guestCookie?.value);
    expect(parsed).not.toBeNull();
    expect(parsed?.guestSessionId).toBe(response.body.data.guestSessionId);
    expect(parsed?.rawSecret).toHaveLength(64);
  });

  it("stores SHA-256 hash and never plaintext secret in database", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/guest-session",
      body: {},
    });

    const cookies = parseSetCookies(response);
    const guestCookie = cookies.find((c) => c.name === SF_GUEST_COOKIE_NAME);
    const parsed = parseGuestCookie(guestCookie?.value);
    expect(parsed).not.toBeNull();
    if (!parsed) throw new Error("parsed guest cookie is null");

    const doc = await runInOrganizationContext(world.organizationA, () =>
      sessionModel().findOne({ guestSessionId: parsed.guestSessionId }),
    );
    expect(doc).not.toBeNull();
    if (!doc) throw new Error("session doc is null");

    expect(doc.organizationId).toBe(world.organizationA);
    expect(doc.secretHash).toBe(hashGuestSecret(parsed.rawSecret));
    expect(doc.secretHash).toHaveLength(64);

    const serialized = JSON.stringify(doc);
    expect(serialized.includes(parsed.rawSecret)).toBe(false);
  });

  it("sets 30-day absolute expiry on guest session and cookie", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/guest-session",
      body: {},
    });

    const doc = await runInOrganizationContext(world.organizationA, () =>
      sessionModel().findOne({ guestSessionId: response.body.data.guestSessionId }),
    );
    expect(doc).not.toBeNull();
    if (!doc) throw new Error("session doc is null");

    const expectedMs = GUEST_SESSION_ABSOLUTE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const actualDiff = doc.expiresAt.getTime() - doc.createdAt.getTime();
    expect(Math.abs(actualDiff - expectedMs)).toBeLessThanOrEqual(5000);

    const cookies = parseSetCookies(response);
    const guestCookie = cookies.find((c) => c.name === SF_GUEST_COOKIE_NAME);
    const maxAgeAttr = guestCookie?.attributes.find((a) => a.toLowerCase().startsWith("max-age="));
    expect(maxAgeAttr).toBeDefined();
    const maxAgeSeconds = Number(maxAgeAttr?.split("=")[1]);
    expect(maxAgeSeconds).toBe(GUEST_SESSION_ABSOLUTE_EXPIRY_DAYS * 24 * 60 * 60);
  });

  it("authenticates subsequent storefront requests using sf_guest cookie", async () => {
    const world = await worldFor(harness, RETAIL);

    const created = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/guest-session",
      body: {},
    });

    const guestCookie = parseSetCookies(created).find((c) => c.name === SF_GUEST_COOKIE_NAME);
    expect(guestCookie).toBeDefined();
    if (!guestCookie) throw new Error("guest cookie missing");

    const response = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/guest-session/me",
      cookies: { [SF_GUEST_COOKIE_NAME]: guestCookie.value },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.guestSessionId).toBe(created.body.data.guestSessionId);
  });

  it("rejects guest session cookie belonging to another organization (cross-org isolation)", async () => {
    const worldA = await worldFor(harness, RETAIL);
    const worldB = await worldFor(harness, RETAIL);

    const createdInA = await callStorefront(harness.app, {
      method: "post",
      organizationId: worldA.organizationA,
      suffix: "/guest-session",
      body: {},
    });

    const cookieA = parseSetCookies(createdInA).find((c) => c.name === SF_GUEST_COOKIE_NAME);
    expect(cookieA).toBeDefined();
    if (!cookieA) throw new Error("cookieA missing");

    const response = await callStorefront(harness.app, {
      method: "get",
      organizationId: worldB.organizationA,
      suffix: "/guest-session/me",
      cookies: { [SF_GUEST_COOKIE_NAME]: cookieA.value },
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODE.UNAUTHENTICATED);
  });

  it("rejects expired guest session and clears stale cookie", async () => {
    const world = await worldFor(harness, RETAIL);

    const created = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/guest-session",
      body: {},
    });

    const cookie = parseSetCookies(created).find((c) => c.name === SF_GUEST_COOKIE_NAME);
    expect(cookie).toBeDefined();
    if (!cookie) throw new Error("cookie missing");

    const guestSessionId = created.body.data.guestSessionId;

    // Manually expire session in DB
    await runInOrganizationContext(world.organizationA, () =>
      sessionModel().updateOne(
        { guestSessionId },
        { $set: { expiresAt: new Date(Date.now() - 60000) } },
      ),
    );

    const response = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/guest-session/me",
      cookies: { [SF_GUEST_COOKIE_NAME]: cookie.value },
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODE.WEBSITE_GUEST_SESSION_EXPIRED);

    // Stale cookie is cleared
    const returnCookies = parseSetCookies(response);
    const cleared = returnCookies.find((c) => c.name === SF_GUEST_COOKIE_NAME);
    expect(cleared).toBeDefined();
    const isCleared =
      cleared?.value === "" ||
      cleared?.attributes.some((a) => a.toLowerCase().includes("max-age=0"));
    expect(isCleared).toBe(true);
  });

  it("rejects forged, tampered, or invalid secret hash", async () => {
    const world = await worldFor(harness, RETAIL);

    const created = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/guest-session",
      body: {},
    });

    const guestSessionId = created.body.data.guestSessionId;
    // Forged raw secret with wrong characters
    const forgedSecret = "0000000000000000000000000000000000000000000000000000000000000000";
    const forgedCookie = formatGuestCookie(guestSessionId, forgedSecret);

    const response = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/guest-session/me",
      cookies: { [SF_GUEST_COOKIE_NAME]: forgedCookie },
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODE.UNAUTHENTICATED);
  });

  it("enforces IP rate limit of 10 guest sessions per hour per IP", async () => {
    const world = await worldFor(harness, RETAIL);
    const testIp = freshIp();

    // 10 calls succeed
    for (let i = 0; i < 10; i++) {
      const res = await callStorefront(harness.app, {
        method: "post",
        organizationId: world.organizationA,
        suffix: "/guest-session",
        body: {},
        ip: testIp,
      });
      expect(res.status, `Attempt ${i + 1} should succeed`).toBe(201);
    }

    // 11th call exceeds rate limit
    const blocked = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/guest-session",
      body: {},
      ip: testIp,
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe(ERROR_CODE.RATE_LIMITED);
  });

  it("refuses guest session creation when website.guestCheckout setting is false", async () => {
    const world = await worldFor(harness, RETAIL);

    // Disable guest checkout via setting
    await runInOrganizationContext(world.organizationA, () =>
      settingModel().create({
        settingValueId: newId(),
        organizationId: world.organizationA,
        settingKey: WEBSITE_GUEST_CHECKOUT_SETTING_KEY,
        locationId: null,
        value: false,
        version: 1,
        createdByUserId: null,
        updatedByUserId: null,
      }),
    );

    const response = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/guest-session",
      body: {},
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODE.WEBSITE_GUEST_CHECKOUT_DISABLED);
  });

  it("refuses guest session creation when website module is disabled (404)", async () => {
    const world = await worldFor(harness, RETAIL);

    // Revoke website module
    await writeModuleOverride({
      organizationId: world.organizationA,
      moduleKey: MODULE_KEY.WEBSITE,
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
    });

    const response = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/guest-session",
      body: {},
    });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODE.NOT_FOUND);
  });
});
