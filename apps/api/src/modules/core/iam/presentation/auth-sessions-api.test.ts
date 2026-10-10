import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asCookies,
  callApi,
  parseSetCookies,
  readSessionCookies,
  type SessionCookies,
} from "../../../../test-support/auth-api-client.js";
import { loginViaApi, registerViaApi } from "../../../../test-support/auth-api-scenarios.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

function refresh(session: SessionCookies) {
  return callApi(harness.app, {
    method: "post",
    path: "/api/v1/auth/refresh",
    cookies: { refresh_token: session.refresh },
  });
}

function readMe(session: SessionCookies) {
  return callApi(harness.app, { method: "get", path: "/api/v1/me", cookies: asCookies(session) });
}

function clearsBothCookies(response: Awaited<ReturnType<typeof refresh>>): boolean {
  const cookies = parseSetCookies(response);
  const isCleared = (name: string): boolean =>
    cookies.some(
      (cookie) =>
        cookie.name === name &&
        cookie.value === "" &&
        cookie.raw.includes("Expires=Thu, 01 Jan 1970"),
    );
  return isCleared("access_token") && isCleared("refresh_token");
}

describe("POST /auth/refresh", () => {
  it("rotates the refresh token: 204 with new cookies, and the old value stops working", async () => {
    const person = await registerViaApi(harness.app);
    harness.clock.advanceSeconds(60);

    const rotated = await refresh(person.session);
    const next = readSessionCookies(rotated);

    expect(rotated.status).toBe(204);
    expect(next.refresh).not.toBe(person.session.refresh);
    expect((await readMe(next)).status).toBe(200);
    expect((await refresh(person.session)).status).toBe(401);
  });

  it("revokes the whole family when an old token is reused after the grace period, and clears cookies", async () => {
    const person = await registerViaApi(harness.app);
    const next = readSessionCookies(await refresh(person.session));
    harness.clock.advanceSeconds(11);

    const reused = await refresh(person.session);
    const newTokenAfterwards = await refresh(next);

    expect(reused.status).toBe(401);
    expect(clearsBothCookies(reused)).toBe(true);
    expect(newTokenAfterwards.status).toBe(401);
    expect(
      harness.logs.lines().some((line) => line["event"] === "auth.refresh_reuse_detected"),
    ).toBe(true);
  });

  it("only answers 401 for a reuse within 10 seconds, keeps the cookies, and the new token still works", async () => {
    const person = await registerViaApi(harness.app);
    const next = readSessionCookies(await refresh(person.session));
    harness.clock.advanceSeconds(10);

    const raced = await refresh(person.session);
    const newTokenAfterwards = await refresh(next);

    expect(raced.status).toBe(401);
    expect(raced.headers["set-cookie"]).toBeUndefined();
    expect(newTokenAfterwards.status).toBe(204);
  });

  it("answers 401 and clears the cookies for an unknown token and for no cookie at all", async () => {
    const unknown = await refresh({ access: "", refresh: "never-issued-token" });
    const missing = await callApi(harness.app, { method: "post", path: "/api/v1/auth/refresh" });

    expect(unknown.status).toBe(401);
    expect(clearsBothCookies(unknown)).toBe(true);
    expect(missing.status).toBe(401);
    expect(clearsBothCookies(missing)).toBe(true);
  });

  it("answers 401 and clears the cookies after 30 days without a refresh", async () => {
    const person = await registerViaApi(harness.app);
    harness.clock.advanceDays(31);

    const response = await refresh(person.session);

    expect(response.status).toBe(401);
    expect(clearsBothCookies(response)).toBe(true);
  });

  it("keeps a person signed in for 30 days of activity but not past the 90-day family limit", async () => {
    const person = await registerViaApi(harness.app);
    let session = person.session;
    for (let renewal = 1; renewal <= 3; renewal += 1) {
      harness.clock.advanceDays(25);
      const response = await refresh(session);
      expect(response.status, `renewal ${renewal}`).toBe(204);
      session = readSessionCookies(response);
    }
    harness.clock.advanceDays(25);

    const pastTheFamilyLimit = await refresh(session);

    expect(pastTheFamilyLimit.status).toBe(401);
  });

  it("lets exactly one of several simultaneous refreshes with the same token succeed", async () => {
    const person = await registerViaApi(harness.app);

    const responses = await Promise.all(Array.from({ length: 5 }, () => refresh(person.session)));

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([204, 401, 401, 401, 401]);
    const winner = responses.find((response) => response.status === 204);
    expect(winner).toBeDefined();
    if (winner === undefined) return;
    expect((await refresh(readSessionCookies(winner))).status).toBe(204);
  });
});

describe("POST /auth/logout", () => {
  it("revokes the session on the server, clears the cookies, and answers 204 even twice or without cookies", async () => {
    const person = await registerViaApi(harness.app);
    const logout = () =>
      callApi(harness.app, {
        method: "post",
        path: "/api/v1/auth/logout",
        cookies: asCookies(person.session),
      });

    const first = await logout();
    const second = await logout();
    const withoutCookies = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/logout",
    });

    expect([first.status, second.status, withoutCookies.status]).toEqual([204, 204, 204]);
    expect(clearsBothCookies(first)).toBe(true);
    expect((await refresh(person.session)).status).toBe(401);
  });
});

describe("POST /auth/logout-all", () => {
  it("revokes the refresh tokens of every device of the person", async () => {
    const person = await registerViaApi(harness.app);
    const otherDevice = await loginViaApi(harness.app, person);

    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/logout-all",
      cookies: asCookies(person.session),
    });

    expect(response.status).toBe(204);
    expect(clearsBothCookies(response)).toBe(true);
    expect((await refresh(otherDevice)).status).toBe(401);
    expect((await refresh(person.session)).status).toBe(401);
  });

  it("does not touch the sessions of other people", async () => {
    const person = await registerViaApi(harness.app);
    const someoneElse = await registerViaApi(harness.app);

    await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/logout-all",
      cookies: asCookies(person.session),
    });

    expect((await refresh(someoneElse.session)).status).toBe(204);
  });

  it("requires a session", async () => {
    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/logout-all",
    });

    expect(response.status).toBe(401);
  });
});
