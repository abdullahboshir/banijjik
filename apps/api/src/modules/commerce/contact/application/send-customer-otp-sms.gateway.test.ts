import { CONTACT_EVENT_TYPE } from "@banijjik/contracts/contact";
import { SMS_OUTCOME, SMS_PURPOSE, SMS_SOURCE } from "@banijjik/contracts/sms";
import { PLATFORM_ROLE } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventHandlerRegistry } from "../../../../kernel/events/event-handler-registry.js";
import { runEventHandler } from "../../../../kernel/events/handler-runner.js";
import { runWithRequestContext } from "../../../../kernel/context/index.js";
import { registerContactHandlers } from "../../../../routes/contact-event-handlers.js";
import { SmsTransientError } from "../../../integration/sms/index.js";
import { createPlatformActor } from "../../../../test-support/platform-world.js";
import {
  callStorefront,
  enableCustomerLogin,
  freshPhone,
  readChallenge,
} from "../../../../test-support/storefront-world.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";
import { startSmsStub } from "../../../../test-support/sms-http-stub.js";

registerIamApiModels();

type ProviderMode = "sent" | "refused" | "transient";

let harness: IamApiHarness;
let world: TwoOrganizations;
let smsStub: Awaited<ReturnType<typeof startSmsStub>>;
let providerMode: ProviderMode = "sent";

beforeAll(async () => {
  smsStub = await startSmsStub((request) => {
    if (request.url === "/auth/tokens") return { body: { token: "gateway-test-token" } };
    if (providerMode === "transient") return { status: 503, body: {} };
    if (providerMode === "refused") return { body: { response_code: 1007 } };
    return { body: { response_code: 202 } };
  });
  harness = await startIamApi({
    environmentOverrides: {
      SMS_ADAREACH_BASE_URL: smsStub.baseUrl,
      SMS_BULKSMSBD_BASE_URL: smsStub.baseUrl,
    },
  });
  world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await enableCustomerLogin(world, world.organizationA);
  const superAdmin = await createPlatformActor(harness.app, harness.connections, [
    PLATFORM_ROLE.SUPER_ADMIN,
  ]);
  const savedGateway = await superAdmin.call("put", "/sms-gateway", {
    version: 0,
    enabled: true,
    activeProvider: "BULKSMSBD",
    bulksmsbd: { senderId: "TEST", apiKey: "platform-otp-key" },
  });
  if (savedGateway.status !== 200) throw new Error("could not save the platform SMS gateway");

  registerContactHandlers(
    {
      ...harness.config,
      storefront: { ...harness.config.storefront, smsDriver: "gateway" },
    },
    {
      config: harness.config.sms,
      clock: harness.clock,
      limits: { async assertBelow() {} },
      policy: {
        async read() {
          return { dailyLimit: 100, timeZone: "Asia/Dhaka" };
        },
      },
    },
  );
});

afterAll(async () => {
  await harness.dispose();
  await smsStub.close();
});

async function requestOtpEvent() {
  const phone = freshPhone();
  const response = await callStorefront(harness.app, {
    method: "post",
    organizationId: world.organizationA,
    suffix: "/auth/otp/send",
    body: { phone },
  });
  expect(response.status).toBe(202);
  const event = await harness.connections.platform
    .collection("outbox_events")
    .findOne(
      { organizationId: world.organizationA, type: CONTACT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED },
      { sort: { createdAt: -1 } },
    );
  if (event === null) throw new Error("customer OTP event missing");
  return { phoneE164: `+88${phone}`, eventId: event["eventId"] as string };
}

async function runOtpEvent(eventId: string) {
  return runWithRequestContext({ requestId: "test-otp-event" }, () =>
    runEventHandler(
      {
        eventId,
        handlerKey: "contact.sendCustomerOtp",
        type: CONTACT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED,
        organizationId: world.organizationA,
      },
      eventHandlerRegistry,
      { isEffective: async () => true },
    ),
  );
}

async function smsLogs(phoneE164: string) {
  return harness.connections.tenantShared
    .collection("sms_logs")
    .find({
      organizationId: world.organizationA,
      phoneLastDigits: phoneE164.slice(-3),
      purpose: SMS_PURPOSE.CUSTOMER_OTP,
    })
    .toArray();
}

describe("customer OTP through the registered gateway sender", () => {
  it("sends a sign-in code through the platform gateway and clears the sealed code", async () => {
    providerMode = "sent";
    const requested = await requestOtpEvent();
    expect(await runOtpEvent(requested.eventId)).toBe("HANDLED");

    const challenge = await readChallenge(world.organizationA, requested.phoneE164);
    const logs = await smsLogs(requested.phoneE164);
    expect(challenge?.codeCiphertext).toBeUndefined();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      purpose: SMS_PURPOSE.CUSTOMER_OTP,
      source: SMS_SOURCE.PLATFORM,
      outcome: SMS_OUTCOME.SENT,
    });
    const sent = smsStub.requests.find((request) => request.url === "/smsapi");
    expect(new URLSearchParams(sent?.body).get("api_key")).toBe("platform-otp-key");
  });

  it("does not retry a permanent refusal and clears the sealed code", async () => {
    providerMode = "refused";
    const requested = await requestOtpEvent();
    expect(await runOtpEvent(requested.eventId)).toBe("HANDLED");

    const challenge = await readChallenge(world.organizationA, requested.phoneE164);
    const logs = await smsLogs(requested.phoneE164);
    expect(challenge?.codeCiphertext).toBeUndefined();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ outcome: SMS_OUTCOME.REFUSED, source: SMS_SOURCE.PLATFORM });
  });

  it("retries a transient fault without a SENT log or clearing the sealed code", async () => {
    providerMode = "transient";
    const requested = await requestOtpEvent();
    await expect(runOtpEvent(requested.eventId)).rejects.toBeInstanceOf(SmsTransientError);

    const challenge = await readChallenge(world.organizationA, requested.phoneE164);
    expect(challenge?.codeCiphertext).toBeTruthy();
    expect(await smsLogs(requested.phoneE164)).toEqual([]);
  });
});
