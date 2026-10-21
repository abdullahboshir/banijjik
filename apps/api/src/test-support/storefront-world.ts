import { CONTACT_EVENT_TYPE } from "@banijjik/contracts/contact";
import {
  STOREFRONT_ACCESS_COOKIE_NAME,
  STOREFRONT_REFRESH_COOKIE_NAME,
} from "@banijjik/contracts/contact";
import { DEVELOPMENT_OTP_SECRET } from "../config/env.schema.js";
import type { Express } from "express";
import type { Response, Test } from "supertest";
import type { DatabaseConnections } from "../kernel/db/index.js";
import { models } from "../kernel/db/index.js";
import { buildSendCustomerOtpSmsHandler } from "../modules/commerce/contact/application/send-customer-otp-sms.handler.js";
import { MongoOtpChallengeRepository } from "../modules/commerce/contact/infrastructure/mongo-otp-challenge.repository.js";
import {
  OTP_CHALLENGE_MODEL_NAME,
  type OtpChallengeDocument,
  SMS_TEST_MESSAGE_MODEL_NAME,
  type SmsTestMessageDocument,
} from "../modules/commerce/contact/infrastructure/customer-account.schema.js";
import { TestInboxSmsSender } from "../modules/commerce/contact/infrastructure/sms-senders.js";
import { buildOtpMessageComposer } from "../routes/contact-event-handlers.js";
import { callApi, parseSetCookies, freshIp } from "./auth-api-client.js";
import { withOrganizationContext } from "./organization-context.js";
import type { TwoOrganizations } from "./two-organizations.js";

export const CODE_PATTERN = /\b(\d{6})\b/;
/** The tests run with the development secret, which the config gives outside production. */
export const TEST_OTP_SECRET = DEVELOPMENT_OTP_SECRET;

let issuedPhones = 0;

/** A fresh Bangladeshi mobile number per call, so the per-phone limits of one test never reach another. */
export function freshPhone(): string {
  issuedPhones += 1;
  return `0171${String(1_000_000 + issuedPhones)}`;
}

export function storefrontPath(organizationId: string, suffix: string): string {
  return `/storefront/orgs/${organizationId}${suffix}`;
}

export interface StorefrontCall {
  readonly method: "get" | "post" | "put" | "delete";
  readonly organizationId: string;
  readonly suffix: string;
  readonly body?: object;
  readonly cookies?: Record<string, string>;
  readonly ip?: string;
  readonly query?: Record<string, string | number>;
  /** Null sends none; omitted sends one (a POST would otherwise fail the kernel rule). */
  readonly idempotencyKey?: string | null;
}

/** A public call: no admin session. The storefront does not need an Idempotency-Key except unlock. */
export function callStorefront(app: Express, call: StorefrontCall): Test {
  const query =
    call.query === undefined
      ? ""
      : `?${new URLSearchParams(
          Object.fromEntries(
            Object.entries(call.query).map(([key, value]) => [key, String(value)]),
          ),
        ).toString()}`;
  return callApi(app, {
    method: call.method,
    path: `/api/v1${storefrontPath(call.organizationId, call.suffix)}${query}`,
    idempotencyKey: call.idempotencyKey === undefined ? null : call.idempotencyKey,
    ip: call.ip ?? freshIp(),
    ...(call.body === undefined ? {} : { body: call.body }),
    ...(call.cookies === undefined ? {} : { cookies: call.cookies }),
  });
}

/** Switches customer sign-in on for business A (it is off by default). */
export async function enableCustomerLogin(
  world: TwoOrganizations,
  organizationId: string,
): Promise<void> {
  const owner = organizationId === world.organizationA ? world.alice : world.bob;
  const response = await owner.call("patch", `/orgs/${organizationId}/settings`, {
    items: [{ settingKey: "contact.customerLogin", value: true }],
  });
  if (response.status !== 200)
    throw new Error(`could not enable customer login: ${response.status}`);
}

/**
 * Plays the worker for the sign-in SMS: opens each pending challenge, sends it through the test
 * inbox and clears the sealed code. The real handler runs, the queue is the only part left out.
 */
export async function deliverPendingOtpSms(
  connections: DatabaseConnections,
  organizationId: string,
  otpSecret: string,
): Promise<void> {
  const handler = buildSendCustomerOtpSmsHandler({
    challenges: new MongoOtpChallengeRepository(),
    sender: new TestInboxSmsSender(),
    composer: buildOtpMessageComposer(),
    otpSecret,
  });
  const events = await connections.platform
    .collection("outbox_events")
    .find({ organizationId, type: CONTACT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED })
    .toArray();
  for (const event of events) {
    await withOrganizationContext(organizationId, () =>
      handler.handle({
        eventId: event["eventId"] as string,
        type: CONTACT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED,
        version: 1,
        occurredAt: (event["occurredAt"] as Date).toISOString(),
        organizationId,
        actorUserId: null,
        payload: {
          otpChallengeId: (event["payload"] as { otpChallengeId: string }).otpChallengeId,
        },
      }),
    );
  }
}

export function readInbox(
  organizationId: string,
  phoneE164: string,
): Promise<SmsTestMessageDocument[]> {
  return withOrganizationContext(organizationId, () =>
    models({})
      .get<SmsTestMessageDocument>(SMS_TEST_MESSAGE_MODEL_NAME)
      .find({ phoneE164 })
      .sort({ createdAt: 1 })
      .lean<SmsTestMessageDocument[]>(),
  );
}

/** The six-digit code of the newest SMS sent to the phone. */
export async function latestCode(organizationId: string, phoneE164: string): Promise<string> {
  const messages = await readInbox(organizationId, phoneE164);
  const text = messages.at(-1)?.text ?? "";
  const match = CODE_PATTERN.exec(text);
  if (match?.[1] === undefined) throw new Error("no code in the test inbox");
  return match[1];
}

export interface CustomerSessionCookies {
  readonly access: string;
  readonly refresh: string;
}

export function readCustomerCookies(response: Response): CustomerSessionCookies {
  const cookies = parseSetCookies(response);
  const access = cookies.find((cookie) => cookie.name === STOREFRONT_ACCESS_COOKIE_NAME);
  const refresh = cookies.find((cookie) => cookie.name === STOREFRONT_REFRESH_COOKIE_NAME);
  if (access === undefined || refresh === undefined) throw new Error("customer cookies missing");
  return { access: access.value, refresh: refresh.value };
}

export function asCustomerCookies(session: CustomerSessionCookies): Record<string, string> {
  return {
    [STOREFRONT_ACCESS_COOKIE_NAME]: session.access,
    [STOREFRONT_REFRESH_COOKIE_NAME]: session.refresh,
  };
}

export interface SignedInCustomer {
  readonly phone: string;
  readonly session: CustomerSessionCookies;
  readonly verifyResponse: Response;
}

/** The whole happy path: ask for a code, read it from the test inbox, verify it. */
export async function signInCustomer(
  stack: { readonly app: Express; readonly connections: DatabaseConnections },
  organizationId: string,
  phone = freshPhone(),
): Promise<SignedInCustomer> {
  const { app, connections } = stack;
  const sent = await callStorefront(app, {
    method: "post",
    organizationId,
    suffix: "/auth/otp/send",
    body: { phone },
  });
  if (sent.status !== 202) throw new Error(`send failed: ${sent.status}`);
  await deliverPendingOtpSms(connections, organizationId, TEST_OTP_SECRET);
  const phoneE164 = `+88${phone}`;
  const code = await latestCode(organizationId, phoneE164);
  const verifyResponse = await callStorefront(app, {
    method: "post",
    organizationId,
    suffix: "/auth/otp/verify",
    body: { phone, code },
  });
  if (verifyResponse.status !== 200) throw new Error(`verify failed: ${verifyResponse.status}`);
  return { phone, session: readCustomerCookies(verifyResponse), verifyResponse };
}

export function readChallenge(
  organizationId: string,
  phoneE164: string,
): Promise<OtpChallengeDocument | null> {
  return withOrganizationContext(organizationId, () =>
    models({})
      .get<OtpChallengeDocument>(OTP_CHALLENGE_MODEL_NAME)
      .findOne({ phoneE164 })
      .lean<OtpChallengeDocument>(),
  );
}
