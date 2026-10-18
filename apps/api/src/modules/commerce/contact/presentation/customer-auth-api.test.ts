import { STOREFRONT_ACCESS_COOKIE_NAME } from "@banijjik/contracts/contact";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callApi, freshIp, parseSetCookies } from "../../../../test-support/auth-api-client.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  asCustomerCookies,
  callStorefront,
  CODE_PATTERN,
  deliverPendingOtpSms,
  enableCustomerLogin,
  freshPhone,
  latestCode,
  readCustomerCookies,
  readInbox,
  signInCustomer,
  TEST_OTP_SECRET,
} from "../../../../test-support/storefront-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function aWorldWithLoginOn(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await enableCustomerLogin(world, world.organizationA);
  await enableCustomerLogin(world, world.organizationB);
  return world;
}

function signIn(world: TwoOrganizations, phone?: string) {
  return signInCustomer(harness, world.organizationA, phone);
}

function refreshCall(world: TwoOrganizations, session: { access: string; refresh: string }) {
  return callStorefront(harness.app, {
    method: "post",
    organizationId: world.organizationA,
    suffix: "/auth/refresh",
    cookies: asCustomerCookies(session),
  });
}

describe("customer sign-in with a phone code", () => {
  it("sends one SMS with a six-digit code and the business name", async () => {
    const world = await aWorldWithLoginOn();
    const phone = freshPhone();

    const sent = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/auth/otp/send",
      body: { phone },
    });
    await deliverPendingOtpSms(harness.connections, world.organizationA, TEST_OTP_SECRET);

    expect(sent.status).toBe(202);
    expect(sent.body.data).toEqual({ expiresInSeconds: 300 });
    const inbox = await readInbox(world.organizationA, `+88${phone}`);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.text).toMatch(CODE_PATTERN);
    expect(inbox[0]?.text).toContain("Org A");
  });

  it("sets two host-only httpOnly cookies, creates the CUSTOMER contact and answers /me", async () => {
    const world = await aWorldWithLoginOn();

    const customer = await signIn(world);

    const cookies = parseSetCookies(customer.verifyResponse);
    expect(cookies.map((cookie) => cookie.name).sort()).toEqual(["sf_access", "sf_refresh"]);
    for (const cookie of cookies) {
      expect(cookie.attributes).toContain("HttpOnly");
      expect(cookie.attributes).toContain("SameSite=Lax");
      expect(cookie.attributes.some((attribute) => attribute.startsWith("Domain="))).toBe(false);
    }
    const me = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/me",
      cookies: asCustomerCookies(customer.session),
    });
    expect(me.status).toBe(200);
    expect(me.body.data.phoneE164).toBe(`+88${customer.phone}`);
    const contact = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${me.body.data.contactId}`,
    );
    expect(contact.body.data).toMatchObject({
      contactRoles: ["CUSTOMER"],
      source: "STOREFRONT",
      phoneE164: `+88${customer.phone}`,
    });
  });

  it("links the existing contact of that phone instead of creating a duplicate", async () => {
    const world = await aWorldWithLoginOn();
    const phone = freshPhone();
    const existing = await world.alice.call("post", `/orgs/${world.organizationA}/contacts`, {
      contactType: "PERSON",
      contactRoles: ["CUSTOMER"],
      name: "Known Customer",
      phoneE164: phone,
    });

    const customer = await signIn(world, phone);
    const second = await signIn(world, phone);

    expect(customer.verifyResponse.body.data.contactId).toBe(existing.body.data.contactId);
    expect(second.verifyResponse.body.data.customerAccountId).toBe(
      customer.verifyResponse.body.data.customerAccountId,
    );
    expect(customer.verifyResponse.body.data.name).toBe("Known Customer");
  });

  it("rotates the refresh token, and ends the session on logout", async () => {
    const world = await aWorldWithLoginOn();
    const customer = await signIn(world);

    const rotated = await refreshCall(world, customer.session);
    const next = readCustomerCookies(rotated);
    const loggedOut = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/auth/logout",
      cookies: asCustomerCookies(next),
    });
    const afterLogout = await refreshCall(world, next);

    expect(rotated.status).toBe(204);
    expect(next.refresh).not.toBe(customer.session.refresh);
    expect(loggedOut.status).toBe(204);
    expect(afterLogout.status).toBe(401);
  });

  it("refuses a refresh token replaced a moment ago without ending the session (two requests racing)", async () => {
    const world = await aWorldWithLoginOn();
    const customer = await signIn(world);
    const next = readCustomerCookies(await refreshCall(world, customer.session));

    const race = await refreshCall(world, customer.session);
    const successor = await refreshCall(world, next);

    expect(race.status).toBe(401);
    expect(successor.status).toBe(204);
  });

  it("treats a refresh token replaced longer ago as theft and ends the session", async () => {
    const world = await aWorldWithLoginOn();
    const customer = await signIn(world);
    const next = readCustomerCookies(await refreshCall(world, customer.session));
    harness.clock.advanceSeconds(11);

    const replay = await refreshCall(world, customer.session);
    const successor = await refreshCall(world, next);

    expect(replay.status).toBe(401);
    expect(successor.status).toBe(401);
  });

  it("refuses a wrong code with one answer and no hint", async () => {
    const world = await aWorldWithLoginOn();
    const phone = freshPhone();
    await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/auth/otp/send",
      body: { phone },
    });
    await deliverPendingOtpSms(harness.connections, world.organizationA, TEST_OTP_SECRET);
    const code = await latestCode(world.organizationA, `+88${phone}`);

    const response = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/auth/otp/verify",
      body: { phone, code: code === "000000" ? "111111" : "000000" },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.messageKey).toBe("errors.otp_invalid");
  });

  it("rejects a malformed phone or code with a validation error", async () => {
    const world = await aWorldWithLoginOn();

    const badPhone = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/auth/otp/send",
      body: { phone: "123" },
    });
    const badCode = await callStorefront(harness.app, {
      method: "post",
      organizationId: world.organizationA,
      suffix: "/auth/otp/verify",
      body: { phone: freshPhone(), code: "12" },
    });

    expect(badPhone.status).toBe(400);
    expect(badCode.status).toBe(400);
  });
});

describe("the public host lookup", () => {
  it("maps a business's host to its organization id and answers 404 for anything else", async () => {
    const world = await aWorldWithLoginOn();
    const row = await harness.connections.platform
      .collection("organizations")
      .findOne({ organizationId: world.organizationA });
    const slug = row?.["slug"] as string;
    const resolve = (host: string) =>
      callApi(harness.app, {
        method: "get",
        path: `/api/v1/storefront/resolve?host=${encodeURIComponent(host)}`,
        ip: freshIp(),
      });

    const found = await resolve(`${slug}.localhost:3000`);
    const unknown = await resolve("nobody-here.localhost");
    const foreign = await resolve(`${slug}.example.org`);
    const nested = await resolve(`a.${slug}.localhost`);

    expect(found.status).toBe(200);
    expect(found.body.data).toEqual({ organizationId: world.organizationA });
    expect(unknown.status).toBe(404);
    expect(foreign.status).toBe(404);
    expect(nested.status).toBe(404);
  });
});

describe("isolation", () => {
  it("rejects an account of business A at business B with 401", async () => {
    const world = await aWorldWithLoginOn();
    const customer = await signIn(world);

    const atB = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationB,
      suffix: "/me",
      cookies: asCustomerCookies(customer.session),
    });

    expect(atB.status).toBe(401);
  });

  it("rejects an admin token on a storefront route, and a customer token on an admin route", async () => {
    const world = await aWorldWithLoginOn();
    const customer = await signIn(world);

    const adminAtStorefront = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/me",
      cookies: { [STOREFRONT_ACCESS_COOKIE_NAME]: world.alice.person.session.access },
    });
    const customerAtAdmin = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/me",
      cookies: { access_token: customer.session.access },
    });

    expect(adminAtStorefront.status).toBe(401);
    expect(customerAtAdmin.status).toBe(401);
  });

  it("answers 404 on every customer route while the business has customer sign-in off", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const call = (method: "get" | "post", suffix: string, body?: object) =>
      callStorefront(harness.app, {
        method,
        organizationId: world.organizationA,
        suffix,
        ...(body === undefined ? {} : { body }),
      });

    const responses = await Promise.all([
      call("post", "/auth/otp/send", { phone: freshPhone() }),
      call("post", "/auth/otp/verify", { phone: freshPhone(), code: "123456" }),
      call("post", "/auth/refresh"),
      call("post", "/auth/logout"),
      call("get", "/me"),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body.error.messageKey).toBe("errors.storefront_not_available");
    }
  });

  it("answers 404 for a business that does not exist", async () => {
    const response = await callStorefront(harness.app, {
      method: "post",
      organizationId: "0199a3b2-7c11-7a3e-9d5e-1f2e3d4c5b6a",
      suffix: "/auth/otp/send",
      body: { phone: freshPhone() },
    });

    expect(response.status).toBe(404);
  });
});
