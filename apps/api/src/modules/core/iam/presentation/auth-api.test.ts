import { TOKEN_AUDIENCE, type MeResponse } from "@banijjik/contracts";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asCookies,
  callApi,
  parseSetCookies,
  readSessionCookies,
} from "../../../../test-support/auth-api-client.js";
import {
  API_PASSWORD,
  loginViaApi,
  registerViaApi,
  uniqueEmail,
} from "../../../../test-support/auth-api-scenarios.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { ALLOWED_ORIGIN, TEST_ACCESS_TOKEN_SECRET } from "../../../../test-support/test-config.js";
import {
  ACCESS_TOKEN_ALGORITHM,
  audienceClaim,
  secretToKey,
} from "../../../../kernel/auth/index.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

describe("register, read the profile, log out", () => {
  it("registers, reads /me with the cookies, logs out, and then /me is 401", async () => {
    const agent = request.agent(harness.app);
    const email = uniqueEmail();

    const registered = await agent
      .post("/api/v1/auth/register")
      .set("X-Forwarded-For", "10.1.0.1")
      .send({ name: "Rahim Uddin", email, password: API_PASSWORD });
    const me = await agent.get("/api/v1/me");
    const loggedOut = await agent.post("/api/v1/auth/logout").set("X-Forwarded-For", "10.1.0.1");
    const meAfterLogout = await agent.get("/api/v1/me");

    expect(registered.status).toBe(201);
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ name: "Rahim Uddin", email, version: 1 });
    expect(loggedOut.status).toBe(204);
    expect(meAfterLogout.status).toBe(401);
  });

  it("answers register with the profile only: no token, hash or status in the body", async () => {
    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/register",
      body: {
        name: "Rahim Uddin",
        phone: "01712345601",
        password: API_PASSWORD,
      },
    });

    const session = readSessionCookies(response);
    const text = JSON.stringify(response.body);
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({
      userId: expect.any(String),
      name: "Rahim Uddin",
      phoneE164: "+8801712345601",
      preferredLocale: "bn",
      isEmailVerified: false,
      isPhoneVerified: false,
      version: 1,
    });
    expect(text).not.toContain(session.access);
    expect(text).not.toContain(session.refresh);
    expect(text).not.toMatch(/passwordHash|argon2|status/);
  });

  it("sets both cookies httpOnly, SameSite=Lax and with the planned paths and lifetimes", async () => {
    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/register",
      body: {
        name: "Rahim Uddin",
        email: uniqueEmail(),
        password: API_PASSWORD,
      },
    });

    const [access, refresh] = ["access_token", "refresh_token"].map((name) =>
      parseSetCookies(response).find((cookie) => cookie.name === name),
    );
    expect(access?.attributes).toEqual(
      expect.arrayContaining(["HttpOnly", "SameSite=Lax", "Path=/api", "Max-Age=900"]),
    );
    expect(refresh?.attributes).toEqual(
      expect.arrayContaining([
        "HttpOnly",
        "SameSite=Lax",
        "Path=/api/v1/auth",
        `Max-Age=${30 * 24 * 60 * 60}`,
      ]),
    );
  });

  it("rejects an email that is already registered with 409 DUPLICATE on the email field", async () => {
    const person = await registerViaApi(harness.app);

    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/register",
      body: {
        name: "Someone Else",
        email: person.email.toUpperCase(),
        password: API_PASSWORD,
      },
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({ code: "DUPLICATE", details: { field: "email" } });
  });

  it("rejects a phone number that is already registered, whatever format it was typed in", async () => {
    const body = { name: "Rahim Uddin", password: API_PASSWORD };
    await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/register",
      body: { ...body, phone: "01712345602" },
    });

    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/register",
      body: {
        ...body,
        phone: "+880 1712-345602",
      },
    });

    expect(response.status).toBe(409);
    expect(response.body.error.details).toEqual({ field: "phone" });
  });
});

describe("login", () => {
  it("logs in by email and by a phone number in local format", async () => {
    const email = uniqueEmail();
    await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/register",
      body: {
        name: "Rahim Uddin",
        email,
        phone: "01712345603",
        password: API_PASSWORD,
      },
    });

    const byEmail = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: {
        identifier: email,
        password: API_PASSWORD,
      },
    });
    const byPhone = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: {
        identifier: "01712345603",
        password: API_PASSWORD,
      },
    });

    expect(byEmail.status).toBe(200);
    expect(byPhone.status).toBe(200);
    expect(byPhone.body.data.phoneE164).toBe("+8801712345603");
    expect(JSON.stringify(byPhone.body)).not.toContain(readSessionCookies(byPhone).access);
  });

  it("gives a wrong password and an unknown identifier the same 401 body", async () => {
    const person = await registerViaApi(harness.app);

    const wrongPassword = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: {
        identifier: person.email,
        password: "this is the wrong password",
      },
    });
    const unknownUser = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: {
        identifier: "nobody-here@example.com",
        password: "this is the wrong password",
      },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    const withoutRequestId = (body: { error: object }): object => ({
      ...body.error,
      requestId: undefined,
    });
    expect(withoutRequestId(wrongPassword.body)).toEqual(withoutRequestId(unknownUser.body));
    expect(wrongPassword.body.error.messageKey).toBe("errors.invalid_credentials");
  });

  it("answers 429 RATE_LIMITED with Retry-After on the sixth failed login, and a success resets the count", async () => {
    const person = await registerViaApi(harness.app);
    const wrong = { identifier: person.email, password: "this is the wrong password" };
    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      statuses.push(
        (await callApi(harness.app, { method: "post", path: "/api/v1/auth/login", body: wrong }))
          .status,
      );
    }

    const sixth = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: wrong,
    });
    const rightWhileLimited = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: {
        identifier: person.email,
        password: person.password,
      },
    });

    expect(statuses).toEqual([401, 401, 401, 401, 401]);
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe("RATE_LIMITED");
    expect(Number(sixth.headers["retry-after"])).toBeGreaterThan(0);
    expect(rightWhileLimited.status).toBe(429);

    harness.clock.advanceSeconds(15 * 60);
    const afterWindow = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: {
        identifier: person.email,
        password: person.password,
      },
    });
    expect(afterWindow.status).toBe(200);
  });

  it("clears the failure counter after a successful login", async () => {
    const person = await registerViaApi(harness.app);
    const wrong = { identifier: person.email, password: "this is the wrong password" };
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await callApi(harness.app, { method: "post", path: "/api/v1/auth/login", body: wrong });
    }
    await loginViaApi(harness.app, person);

    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      statuses.push(
        (await callApi(harness.app, { method: "post", path: "/api/v1/auth/login", body: wrong }))
          .status,
      );
    }

    expect(statuses).toEqual([401, 401, 401, 401, 401]);
  });
});

describe("validation", () => {
  it("answers 400 with field paths and validation keys for a missing identifier and a short password", async () => {
    const missingIdentifier = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: {
        password: "whatever",
      },
    });
    const shortPassword = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/register",
      body: {
        name: "Rahim Uddin",
        email: uniqueEmail(),
        password: "short",
      },
    });

    expect(missingIdentifier.status).toBe(400);
    expect(missingIdentifier.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      details: { fields: [{ path: "identifier", messageKey: "validation.invalid_type" }] },
    });
    expect(shortPassword.status).toBe(400);
    expect(shortPassword.body.error.details.fields).toEqual([
      { path: "password", messageKey: "validation.password_too_short" },
    ]);
  });

  it("asks for an email or a phone number when both are missing", async () => {
    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/register",
      body: {
        name: "Rahim Uddin",
        password: API_PASSWORD,
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toEqual([
      { path: "email", messageKey: "validation.identifier_required" },
    ]);
  });

  it("refuses fields the endpoint does not know, such as a status", async () => {
    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/register",
      body: {
        name: "Rahim Uddin",
        email: uniqueEmail(),
        password: API_PASSWORD,
        status: "ACTIVE",
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields[0].messageKey).toBe("validation.unrecognized_keys");
  });
});

describe("GET /me without a valid session", () => {
  async function signAccessToken(options: {
    audience?: "ADMIN" | "STOREFRONT";
    expiresInSeconds?: number;
  }): Promise<string> {
    const person = await registerViaApi(harness.app);
    const issuedAt = Math.floor(harness.clock.now().getTime() / 1000);
    return new SignJWT({ sid: "0199a3b2-7c11-7a3e-9d5e-aaaaaaaaaaaa" })
      .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM })
      .setSubject(person.me.userId)
      .setAudience(audienceClaim(options.audience ?? TOKEN_AUDIENCE.ADMIN))
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + (options.expiresInSeconds ?? 900))
      .sign(secretToKey(TEST_ACCESS_TOKEN_SECRET));
  }

  it("answers 401 without a cookie", async () => {
    const response = await callApi(harness.app, { method: "get", path: "/api/v1/me" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("answers 401 for a tampered token", async () => {
    const person = await registerViaApi(harness.app);

    const response = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/me",
      cookies: { access_token: `${person.session.access.slice(0, -4)}AAAA` },
    });

    expect(response.status).toBe(401);
  });

  it("answers 401 for an expired token (the clock moves 16 minutes)", async () => {
    const person = await registerViaApi(harness.app);
    harness.clock.advanceSeconds(16 * 60);

    const response = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/me",
      cookies: { access_token: person.session.access },
    });

    expect(response.status).toBe(401);
  });

  it("answers 401 for a storefront-audience token that is otherwise valid", async () => {
    const token = await signAccessToken({ audience: "STOREFRONT" });
    const valid = await signAccessToken({});

    const refused = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/me",
      cookies: { access_token: token },
    });
    const accepted = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/me",
      cookies: { access_token: valid },
    });

    expect(refused.status).toBe(401);
    expect(accepted.status).toBe(200);
  });
});

describe("PATCH /me", () => {
  it("changes the name and language, returns the new version, and rejects a stale version with 409", async () => {
    const person = await registerViaApi(harness.app);
    const cookies = asCookies(person.session);

    const updated = await callApi(harness.app, {
      method: "patch",
      path: "/api/v1/me",
      body: { name: "Karim Ali", preferredLocale: "en", version: 1 },
      cookies,
    });
    const stale = await callApi(harness.app, {
      method: "patch",
      path: "/api/v1/me",
      body: { name: "Late Edit", version: 1 },
      cookies,
    });

    expect(updated.status).toBe(200);
    expect((updated.body.data as MeResponse).version).toBe(2);
    expect(updated.body.data).toMatchObject({ name: "Karim Ali", preferredLocale: "en" });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toMatchObject({ code: "CONFLICT", details: { currentVersion: 2 } });
  });

  it("requires the version", async () => {
    const person = await registerViaApi(harness.app);

    const response = await callApi(harness.app, {
      method: "patch",
      path: "/api/v1/me",
      body: { name: "No Version" },
      cookies: asCookies(person.session),
    });

    expect(response.status).toBe(400);
  });

  it("requires a session", async () => {
    const response = await callApi(harness.app, {
      method: "patch",
      path: "/api/v1/me",
      body: { name: "X", version: 1 },
    });

    expect(response.status).toBe(401);
  });
});

describe("origin check", () => {
  it("refuses a POST from an origin outside the allow-list", async () => {
    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: { identifier: "a@example.com", password: "x" },
      origin: "https://evil.example.com",
    });

    expect(response.status).toBe(403);
    expect(response.body.error.messageKey).toBe("errors.origin_not_allowed");
  });

  it("lets a POST through from the allowed origin and when no Origin is sent", async () => {
    const body = { identifier: "a@example.com", password: "x" };

    const fromAllowed = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: body,
      origin: ALLOWED_ORIGIN,
    });
    const withoutOrigin = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: body,
    });

    expect(fromAllowed.status).toBe(401);
    expect(withoutOrigin.status).toBe(401);
  });
});

describe("logs", () => {
  it("never contain a password, token, cookie, email or phone number from the whole flow", async () => {
    const email = "private.person@example.com";
    const phone = "01712345699";
    const password = "a-very-recognisable-password-9137";
    const registered = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/register",
      body: {
        name: "Private Person",
        email,
        phone,
        password,
      },
    });
    const session = readSessionCookies(registered);
    await callApi(harness.app, { method: "get", path: "/api/v1/me", cookies: asCookies(session) });
    await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: { identifier: email, password: "x" },
    });
    await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: { identifier: phone, password },
    });
    await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/register",
      body: {
        name: "Private Person",
        email,
        password,
      },
    });
    const refreshed = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/refresh",
      cookies: asCookies(session),
    });
    await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/refresh",
      cookies: asCookies(session),
    });
    await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/logout",
      cookies: asCookies(readSessionCookies(refreshed)),
    });

    const logText = harness.logs.text();
    const secrets = [
      password,
      email,
      phone,
      "+8801712345699",
      session.access,
      session.refresh,
      readSessionCookies(refreshed).access,
      readSessionCookies(refreshed).refresh,
      "access_token=",
      "refresh_token=",
    ];
    expect(logText.length).toBeGreaterThan(0);
    for (const secret of secrets) expect(logText, secret).not.toContain(secret);
  });
});
