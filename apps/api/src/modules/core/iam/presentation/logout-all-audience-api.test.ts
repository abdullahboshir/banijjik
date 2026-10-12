import { PLATFORM_REFRESH_TOKEN_COOKIE_NAME, PLATFORM_ROLE } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asCookies, callApi } from "../../../../test-support/auth-api-client.js";
import type { RegisteredPerson } from "../../../../test-support/auth-api-scenarios.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  asPlatformCookies,
  insertOperator,
  platformLogin,
  readPlatformCookies,
  type PlatformSessionCookies,
} from "../../../../test-support/platform-world.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

interface BothSessions {
  readonly person: RegisteredPerson;
  readonly platform: PlatformSessionCookies;
}

/** One person who is signed in to the business app and to the platform panel at once. */
async function signedInToBoth(): Promise<BothSessions> {
  const { person } = await insertOperator(harness.app, harness.connections, [
    PLATFORM_ROLE.SUPER_ADMIN,
  ]);
  const login = await platformLogin(harness.app, person);
  return { person, platform: readPlatformCookies(login) };
}

async function adminRefreshStatus(both: BothSessions): Promise<number> {
  const response = await callApi(harness.app, {
    method: "post",
    path: "/api/v1/auth/refresh",
    cookies: asCookies(both.person.session),
  });
  return response.status;
}

async function platformRefreshStatus(both: BothSessions): Promise<number> {
  const response = await callApi(harness.app, {
    method: "post",
    path: "/api/v1/platform/auth/refresh",
    cookies: { [PLATFORM_REFRESH_TOKEN_COOKIE_NAME]: both.platform.refresh },
  });
  return response.status;
}

describe("logout-all ends only the sessions of its own audience (review M5)", () => {
  it("leaves the platform session alone when the business app signs out everywhere", async () => {
    const both = await signedInToBoth();

    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/logout-all",
      cookies: asCookies(both.person.session),
    });

    expect(response.status).toBe(204);
    expect(await platformRefreshStatus(both)).toBe(204);
  });

  it("ends every platform session, and leaves the business session alone, on the platform route", async () => {
    const both = await signedInToBoth();

    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/platform/auth/logout-all",
      cookies: asPlatformCookies(both.platform),
    });

    expect(response.status).toBe(204);
    expect(await platformRefreshStatus(both)).toBe(401);
    expect(await adminRefreshStatus(both)).toBe(204);
  });

  it("requires a platform session", async () => {
    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/platform/auth/logout-all",
    });

    expect(response.status).toBe(401);
  });
});
