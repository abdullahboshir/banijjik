import {
  ACCESS_TOKEN_COOKIE_NAME,
  PLATFORM_ACCESS_TOKEN_COOKIE_NAME,
  PLATFORM_PERMISSION_KEY,
  PLATFORM_REFRESH_TOKEN_COOKIE_NAME,
  PLATFORM_ROLE,
  REFRESH_TOKEN_COOKIE_NAME,
  USER_STATUS,
} from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asCookies,
  callApi,
  freshIp,
  parseSetCookies,
  readSessionCookies,
} from "../../../../test-support/auth-api-client.js";
import { API_PASSWORD, registerViaApi } from "../../../../test-support/auth-api-scenarios.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  createPlatformActor,
  insertOperator,
  platformLogin,
  readPlatformCookies,
} from "../../../../test-support/platform-world.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function refreshPlatform(refresh: string) {
  return callApi(harness.app, {
    method: "post",
    path: "/api/v1/platform/auth/refresh",
    cookies: { [PLATFORM_REFRESH_TOKEN_COOKIE_NAME]: refresh },
  });
}

describe("platform sign-in", () => {
  it("signs an ACTIVE operator in and answers with the roles and permissions", async () => {
    const { person } = await insertOperator(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);

    const response = await platformLogin(harness.app, person);

    expect(response.status).toBe(200);
    expect(response.body.data.platformRoles).toEqual([PLATFORM_ROLE.SUPPORT]);
    expect(response.body.data.permissions).toContain(PLATFORM_PERMISSION_KEY.TENANT_SUSPEND);
    expect(response.body.data.permissions).not.toContain(PLATFORM_PERMISSION_KEY.PACKAGE_WRITE);
  });

  it("sets its own httpOnly cookies, with the refresh cookie limited to the platform auth path", async () => {
    const { person } = await insertOperator(harness.app, harness.connections, [
      PLATFORM_ROLE.BILLING,
    ]);

    const response = await platformLogin(harness.app, person);
    const cookies = parseSetCookies(response);
    const access = cookies.find((cookie) => cookie.name === PLATFORM_ACCESS_TOKEN_COOKIE_NAME);
    const refresh = cookies.find((cookie) => cookie.name === PLATFORM_REFRESH_TOKEN_COOKIE_NAME);

    expect(cookies.map((cookie) => cookie.name).sort()).toEqual(
      [PLATFORM_ACCESS_TOKEN_COOKIE_NAME, PLATFORM_REFRESH_TOKEN_COOKIE_NAME].sort(),
    );
    expect(access?.attributes).toContain("Path=/");
    expect(refresh?.attributes).toContain("Path=/api/v1/platform/auth");
    for (const cookie of [access, refresh]) {
      expect(cookie?.attributes).toContain("HttpOnly");
      expect(cookie?.attributes).toContain("SameSite=Lax");
    }
  });

  it("answers a user who is no operator exactly like a wrong password", async () => {
    const stranger = await registerViaApi(harness.app);
    const { person: operator } = await insertOperator(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPER_ADMIN,
    ]);

    const notOperator = await platformLogin(harness.app, stranger);
    const wrongPassword = await platformLogin(harness.app, {
      ...operator,
      password: "wrong one 12345",
    });

    expect(notOperator.status).toBe(401);
    expect(notOperator.body.error.messageKey).toBe("errors.invalid_credentials");
    expect(notOperator.body.error.code).toBe(wrongPassword.body.error.code);
    expect(notOperator.body.error.messageKey).toBe(wrongPassword.body.error.messageKey);
    expect(parseSetCookies(notOperator)).toEqual([]);
  });

  it("refuses an operator whose record is disabled, with the same answer", async () => {
    const { person } = await insertOperator(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);
    await harness.connections.platform
      .collection("platform_operators")
      .updateOne({ userId: person.me.userId }, { $set: { status: USER_STATUS.DISABLED } });

    const response = await platformLogin(harness.app, person);

    expect(response.status).toBe(401);
    expect(response.body.error.messageKey).toBe("errors.invalid_credentials");
  });

  it("counts failed attempts in its own bucket, so the business login of the same person stays open", async () => {
    const { person } = await insertOperator(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);
    const wrong = { ...person, password: "wrong one 12345" };
    const ip = freshIp();

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      statuses.push((await platformLogin(harness.app, wrong, ip)).status);
    }
    const businessLogin = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: { identifier: person.email, password: API_PASSWORD },
      ip,
    });

    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    expect(businessLogin.status).toBe(200);
  });

  it("locks one address after five failures and leaves another address open", async () => {
    const { person } = await insertOperator(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);
    const strangerIp = freshIp();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await platformLogin(harness.app, { ...person, password: "wrong one 12345" }, strangerIp);
    }

    const stranger = await platformLogin(harness.app, person, strangerIp);
    const operator = await platformLogin(harness.app, person, freshIp());

    expect(stranger.status).toBe(429);
    expect(operator.status).toBe(200);
  });

  it("keeps two addresses that send the route maximum of wrong attempts from locking the operator out (review 1, R1-1)", async () => {
    const ATTEMPTS_PER_ADDRESS = 30;
    const { person } = await insertOperator(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);
    for (const ip of [freshIp(), freshIp()]) {
      for (let attempt = 0; attempt < ATTEMPTS_PER_ADDRESS; attempt += 1) {
        await platformLogin(harness.app, { ...person, password: "wrong one 12345" }, ip);
      }
    }

    const operator = await platformLogin(harness.app, person, freshIp());

    expect(operator.status).toBe(200);
  });

  it("locks the operator for every address after 50 failures spread over many addresses", async () => {
    const { person } = await insertOperator(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const failed = await platformLogin(harness.app, { ...person, password: "wrong one 12345" });
      expect(failed.status).toBe(401);
    }

    const fromNewAddress = await platformLogin(harness.app, person);

    expect(fromNewAddress.status).toBe(429);
  });
});
describe("GET /platform/me", () => {
  it("answers the signed-in operator with the roles and permissions", async () => {
    const operator = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.BILLING,
    ]);

    const response = await operator.call("get", "/me");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      platformOperatorId: operator.platformOperatorId,
      userId: operator.userId,
      name: "Rahim Uddin",
      platformRoles: [PLATFORM_ROLE.BILLING],
    });
    expect(response.body.data.permissions).toContain(PLATFORM_PERMISSION_KEY.SUBSCRIPTION_WRITE);
    expect(response.body.data.permissions).not.toContain(PLATFORM_PERMISSION_KEY.PACKAGE_WRITE);
    expect(response.body.data.permissions).not.toContain(PLATFORM_PERMISSION_KEY.TENANT_SUSPEND);
  });

  it("is refused without a platform session", async () => {
    const response = await callApi(harness.app, { method: "get", path: "/api/v1/platform/me" });

    expect(response.status).toBe(401);
  });
});

describe("audiences", () => {
  it("refuses a platform access token on tenant and user routes", async () => {
    const operator = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPER_ADMIN,
    ]);

    const response = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/me",
      cookies: { [ACCESS_TOKEN_COOKIE_NAME]: operator.cookies.access },
    });

    expect(response.status).toBe(401);
  });

  it("refuses an admin access token on platform routes", async () => {
    const person = await registerViaApi(harness.app);

    const response = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/platform/organizations",
      cookies: { [PLATFORM_ACCESS_TOKEN_COOKIE_NAME]: person.session.access },
    });

    expect(response.status).toBe(401);
  });

  it("does not let the admin cookies reach the platform API at all", async () => {
    const { person } = await insertOperator(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPER_ADMIN,
    ]);

    const response = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/platform/organizations",
      cookies: asCookies(person.session),
    });

    expect(response.status).toBe(401);
  });

  it("refuses a disabled operator on the very next request", async () => {
    const operator = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);
    expect((await operator.call("get", "/organizations")).status).toBe(200);
    await harness.connections.platform
      .collection("platform_operators")
      .updateOne({ userId: operator.userId }, { $set: { status: USER_STATUS.DISABLED } });

    const response = await operator.call("get", "/organizations");

    expect(response.status).toBe(401);
  });
});

describe("platform refresh and logout", () => {
  it("renews a platform session and rotates the refresh token", async () => {
    const operator = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);

    const response = await refreshPlatform(operator.cookies.refresh);
    const renewed = readPlatformCookies(response);

    expect(response.status).toBe(204);
    expect(renewed.refresh).not.toBe(operator.cookies.refresh);
    operator.replaceSession(renewed);
    expect((await operator.call("get", "/organizations")).status).toBe(200);
  });

  it("does not renew an admin session at the platform endpoint, nor a platform session at the admin one", async () => {
    const operator = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);
    const adminSession = readSessionCookies(
      await callApi(harness.app, {
        method: "post",
        path: "/api/v1/auth/login",
        body: { identifier: operator.person.email, password: API_PASSWORD },
      }),
    );

    const adminAtPlatform = await refreshPlatform(adminSession.refresh);
    const platformAtAdmin = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/refresh",
      cookies: { [REFRESH_TOKEN_COOKIE_NAME]: operator.cookies.refresh },
    });

    expect(adminAtPlatform.status).toBe(401);
    expect(platformAtAdmin.status).toBe(401);
    // Neither mistake ended the admin session family.
    const stillValid = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/refresh",
      cookies: { [REFRESH_TOKEN_COOKIE_NAME]: adminSession.refresh },
    });
    expect(stillValid.status).toBe(204);
  });

  it("ends the platform session on logout and clears both cookies", async () => {
    const operator = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);

    const logout = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/platform/auth/logout",
      cookies: { [PLATFORM_REFRESH_TOKEN_COOKIE_NAME]: operator.cookies.refresh },
    });

    expect(logout.status).toBe(204);
    expect(
      parseSetCookies(logout)
        .map((cookie) => cookie.name)
        .sort(),
    ).toEqual([PLATFORM_ACCESS_TOKEN_COOKIE_NAME, PLATFORM_REFRESH_TOKEN_COOKIE_NAME].sort());
    expect((await refreshPlatform(operator.cookies.refresh)).status).toBe(401);
  });

  it("stops renewing the session of an operator who was disabled", async () => {
    const operator = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);
    await harness.connections.platform
      .collection("platform_operators")
      .updateOne({ userId: operator.userId }, { $set: { status: USER_STATUS.DISABLED } });

    expect((await refreshPlatform(operator.cookies.refresh)).status).toBe(401);
  });
});
