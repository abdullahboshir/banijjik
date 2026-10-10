import { IDEMPOTENCY_REPLAYED_HEADER } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asCookies, callApi } from "../../../../test-support/auth-api-client.js";
import {
  registerViaApi,
  type RegisteredPerson,
} from "../../../../test-support/auth-api-scenarios.js";
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

const REPLAYED = IDEMPOTENCY_REPLAYED_HEADER.toLowerCase();
let issuedSlugs = 0;

function aBody(): { name: string; slug: string; industryTemplateKey: string } {
  issuedSlugs += 1;
  return { name: "Retry Store", slug: `retry-shop-${issuedSlugs}`, industryTemplateKey: "RETAIL" };
}

function create(person: RegisteredPerson, body: object, idempotencyKey?: string | null) {
  return callApi(harness.app, {
    method: "post",
    path: "/api/v1/me/orgs",
    cookies: asCookies(person.session),
    body,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  });
}

function countBySlug(slug: string): Promise<number> {
  return harness.connections.platform.collection("organizations").countDocuments({ slug });
}

describe("POST /me/orgs with an Idempotency-Key", () => {
  it("replays the first answer and creates one organization", async () => {
    const person = await registerViaApi(harness.app);
    const body = aBody();
    const key = newId();

    const first = await create(person, body, key);
    const second = await create(person, body, key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(second.headers[REPLAYED]).toBe("true");
    expect(await countBySlug(body.slug)).toBe(1);
  });

  it("answers 422 IDEMPOTENCY_MISMATCH when the same key carries another body", async () => {
    const person = await registerViaApi(harness.app);
    const key = newId();
    await create(person, aBody(), key);

    const response = await create(person, aBody(), key);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("IDEMPOTENCY_MISMATCH");
  });

  it("answers 400 without a key and with a key that is not a UUID", async () => {
    const person = await registerViaApi(harness.app);

    const missing = await create(person, aBody(), null);
    const malformed = await create(person, aBody(), "nope");

    expect(missing.status).toBe(400);
    expect(missing.body.error.details.fields[0].messageKey).toBe(
      "validation.idempotency_key_required",
    );
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.details.fields[0].messageKey).toBe(
      "validation.idempotency_key_invalid",
    );
  });

  it("lets the same key work for two different users", async () => {
    const first = await registerViaApi(harness.app);
    const second = await registerViaApi(harness.app);
    const key = newId();

    const firstResponse = await create(first, aBody(), key);
    const secondResponse = await create(second, aBody(), key);

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(secondResponse.headers[REPLAYED]).toBeUndefined();
  });
});
