import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  callStorefront,
  deliverPendingOtpSms,
  enableCustomerLogin,
  freshPhone,
  latestCode,
  readChallenge,
  readInbox,
  signInCustomer,
  TEST_OTP_SECRET,
} from "../../../../test-support/storefront-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";
import { freshIp } from "../../../../test-support/auth-api-client.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function aWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await enableCustomerLogin(world, world.organizationA);
  return world;
}

function send(world: TwoOrganizations, phone: string, ip?: string) {
  return callStorefront(harness.app, {
    method: "post",
    organizationId: world.organizationA,
    suffix: "/auth/otp/send",
    body: { phone },
    ...(ip === undefined ? {} : { ip }),
  });
}

function verify(world: TwoOrganizations, phone: string, code: string) {
  return callStorefront(harness.app, {
    method: "post",
    organizationId: world.organizationA,
    suffix: "/auth/otp/verify",
    body: { phone, code },
  });
}

async function sendAndDeliver(world: TwoOrganizations, phone: string): Promise<string> {
  const response = await send(world, phone);
  expect(response.status).toBe(202);
  await deliverPendingOtpSms(harness.connections, world.organizationA, TEST_OTP_SECRET);
  return latestCode(world.organizationA, `+88${phone}`);
}

function wrongCodeFor(code: string): string {
  return code === "000000" ? "111111" : "000000";
}

describe("asking for a code gives nothing away", () => {
  it("answers an unknown phone, a known phone and a blocked phone in the same way", async () => {
    const world = await aWorld();
    const known = await signInCustomer(harness, world.organizationA);
    const blocked = await signInCustomer(harness, world.organizationA);
    const blockedContactId = blocked.verifyResponse.body.data.contactId as string;
    const blockResponse = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/contacts/${blockedContactId}/customer-account/block`,
      { version: 2 },
    );
    expect(blockResponse.status).toBe(200);

    const unknownAnswer = await send(world, freshPhone());
    const knownAnswer = await send(world, known.phone);
    const blockedAnswer = await send(world, blocked.phone);

    for (const answer of [knownAnswer, blockedAnswer]) {
      expect(answer.status).toBe(unknownAnswer.status);
      expect(answer.body).toEqual(unknownAnswer.body);
    }
  });

  it("sends no SMS and writes no event for a blocked account", async () => {
    const world = await aWorld();
    const blocked = await signInCustomer(harness, world.organizationA);
    await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/contacts/${blocked.verifyResponse.body.data.contactId}/customer-account/block`,
      { version: 2 },
    );
    const inboxBefore = (await readInbox(world.organizationA, `+88${blocked.phone}`)).length;
    const eventsBefore = await harness.connections.platform
      .collection("outbox_events")
      .countDocuments({ type: "contact.customerOtp.requested" });

    await send(world, blocked.phone);
    await deliverPendingOtpSms(harness.connections, world.organizationA, TEST_OTP_SECRET);

    const eventsAfter = await harness.connections.platform
      .collection("outbox_events")
      .countDocuments({ type: "contact.customerOtp.requested" });
    expect(eventsAfter).toBe(eventsBefore);
    expect((await readInbox(world.organizationA, `+88${blocked.phone}`)).length).toBe(inboxBefore);
  });

  it("tells a blocked account only after the code was right, with 403", async () => {
    const world = await aWorld();
    const phone = freshPhone();
    const first = await signInCustomer(harness, world.organizationA, phone);
    const code = await sendAndDeliver(world, phone);
    await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/contacts/${first.verifyResponse.body.data.contactId}/customer-account/block`,
      { version: 2 },
    );

    const wrong = await verify(world, phone, wrongCodeFor(code));
    const right = await verify(world, phone, code);

    expect(wrong.status).toBe(400);
    expect(right.status).toBe(403);
    expect(right.body.error.messageKey).toBe("errors.customer_account_blocked");
  });
});

describe("what a code can cost", () => {
  it("refuses the fourth code for one phone within fifteen minutes, then allows it again", async () => {
    const world = await aWorld();
    const phone = freshPhone();

    const answers = [];
    for (let attempt = 0; attempt < 4; attempt += 1) answers.push(await send(world, phone));

    expect(answers.map((answer) => answer.status)).toEqual([202, 202, 202, 429]);
    expect(answers[3]?.headers["retry-after"]).toBeDefined();
    harness.clock.advanceSeconds(16 * 60);
    expect((await send(world, phone)).status).toBe(202);
  });

  it("refuses the eleventh code from one address, whatever the phones", async () => {
    const world = await aWorld();
    const ip = freshIp();

    const answers = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      answers.push(await send(world, freshPhone(), ip));
    }

    expect(answers.slice(0, 10).every((answer) => answer.status === 202)).toBe(true);
    expect(answers[10]?.status).toBe(429);
    expect((await send(world, freshPhone(), freshIp())).status).toBe(202);
  });

  it("kills the code after five wrong guesses, even for the right code", async () => {
    const world = await aWorld();
    const phone = freshPhone();
    const code = await sendAndDeliver(world, phone);

    for (let guess = 0; guess < 5; guess += 1) {
      expect((await verify(world, phone, wrongCodeFor(code))).status).toBe(400);
    }
    const right = await verify(world, phone, code);

    expect(right.status).toBe(400);
    expect(right.body.error.messageKey).toBe("errors.otp_invalid");
  });

  it("refuses an expired code", async () => {
    const world = await aWorld();
    const phone = freshPhone();
    const code = await sendAndDeliver(world, phone);
    harness.clock.advanceSeconds(301);

    const response = await verify(world, phone, code);

    expect(response.status).toBe(400);
  });

  it("refuses a code that was already used", async () => {
    const world = await aWorld();
    const phone = freshPhone();
    const code = await sendAndDeliver(world, phone);
    expect((await verify(world, phone, code)).status).toBe(200);

    const again = await verify(world, phone, code);

    expect(again.status).toBe(400);
  });

  it("refuses the code of a challenge that a newer request replaced", async () => {
    const world = await aWorld();
    const phone = freshPhone();
    const oldCode = await sendAndDeliver(world, phone);
    let newCode = await sendAndDeliver(world, phone);
    // One chance in a million that two random codes match; ask once more rather than flake.
    if (newCode === oldCode) newCode = await sendAndDeliver(world, phone);
    if (newCode === oldCode) return;

    const old = await verify(world, phone, oldCode);
    const current = await verify(world, phone, newCode);

    expect(old.status).toBe(400);
    expect(current.status).toBe(200);
  });
});

describe("the code stays secret", () => {
  it("is in no log line, outbox event, stored challenge, response or audit entry, and the sealed copy is cleared after sending", async () => {
    const world = await aWorld();
    const phone = freshPhone();
    const phoneE164 = `+88${phone}`;
    const sendResponse = await send(world, phone);
    const sealedBeforeSending = await readChallenge(world.organizationA, phoneE164);
    await deliverPendingOtpSms(harness.connections, world.organizationA, TEST_OTP_SECRET);
    const code = await latestCode(world.organizationA, phoneE164);
    const wrongResponse = await verify(world, phone, wrongCodeFor(code));
    const signedIn = await verify(world, phone, code);

    const outbox = await harness.connections.platform
      .collection("outbox_events")
      .find({ organizationId: world.organizationA })
      .toArray();
    const audit = await harness.connections.tenantShared
      .collection("audit_logs")
      .find({ organizationId: world.organizationA })
      .toArray();
    const stored = await readChallenge(world.organizationA, phoneE164);
    // Searching empty lists would prove nothing: both really hold this sign-in's records.
    expect(outbox.length).toBeGreaterThan(0);
    expect(audit.length).toBeGreaterThan(0);
    const alone = (value: string) => new RegExp(`(?<![0-9a-f])${value}(?![0-9a-f])`);

    expect(sealedBeforeSending?.codeCiphertext).toBeDefined();
    expect(JSON.stringify(sealedBeforeSending)).not.toMatch(alone(code));
    expect(stored?.codeCiphertext).toBeUndefined();
    expect(JSON.stringify(stored)).not.toMatch(alone(code));
    expect(harness.logs.text()).not.toMatch(alone(code));
    expect(JSON.stringify(outbox)).not.toMatch(alone(code));
    expect(JSON.stringify(audit)).not.toMatch(alone(code));
    for (const response of [sendResponse, wrongResponse, signedIn]) {
      expect(JSON.stringify(response.body)).not.toMatch(alone(code));
    }
  });

  it("keeps the full phone number out of the logs, the outbox and the audit trail", async () => {
    const world = await aWorld();
    const customer = await signInCustomer(harness, world.organizationA);
    const phoneE164 = `+88${customer.phone}`;

    const outbox = await harness.connections.platform
      .collection("outbox_events")
      .find({ organizationId: world.organizationA })
      .toArray();
    const audit = await harness.connections.tenantShared
      .collection("audit_logs")
      .find({ organizationId: world.organizationA })
      .toArray();

    expect(outbox.length).toBeGreaterThan(0);
    expect(audit.length).toBeGreaterThan(0);
    for (const haystack of [harness.logs.text(), JSON.stringify(outbox), JSON.stringify(audit)]) {
      expect(haystack).not.toContain(customer.phone);
      expect(haystack).not.toContain(phoneE164);
    }
  });
});
