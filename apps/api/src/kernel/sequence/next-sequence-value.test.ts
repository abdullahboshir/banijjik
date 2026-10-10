import { SEQUENCE_KEY, type SequenceKey } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { initializeModels, withTransaction, type DatabaseConnections } from "../db/index.js";
import { nextSequenceValue } from "./next-sequence-value.js";
import { registerSequenceModel } from "./sequence.schema.js";

const CONCURRENT_CALLS = 50;

registerSequenceModel();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

function next(
  organizationId: string,
  sequenceKey: SequenceKey = SEQUENCE_KEY.ORDER,
): Promise<number> {
  return nextSequenceValue({ organizationId, sequenceKey });
}

describe("nextSequenceValue", () => {
  it("starts at 1 and counts up", async () => {
    const organizationId = newId();

    const values = [
      await next(organizationId),
      await next(organizationId),
      await next(organizationId),
    ];

    expect(values).toEqual([1, 2, 3]);
  });

  it("hands out 1 to 50 without duplicates or gaps for 50 concurrent calls", async () => {
    const organizationId = newId();

    const values = await Promise.all(
      Array.from({ length: CONCURRENT_CALLS }, () => next(organizationId)),
    );

    const sorted = [...values].sort((first, second) => first - second);
    expect(sorted).toEqual(Array.from({ length: CONCURRENT_CALLS }, (_, index) => index + 1));
  });

  it("keeps a separate counter per organization and per key", async () => {
    const firstOrganization = newId();
    const secondOrganization = newId();

    await next(firstOrganization);
    await next(firstOrganization);

    expect(await next(secondOrganization)).toBe(1);
    expect(await next(firstOrganization, SEQUENCE_KEY.INVOICE)).toBe(1);
    expect(await next(firstOrganization)).toBe(3);
  });

  it("rolls the increment back with an aborted transaction", async () => {
    const organizationId = newId();
    await next(organizationId);

    await expect(
      withTransaction(async () => {
        expect(await next(organizationId)).toBe(2);
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");

    expect(await next(organizationId)).toBe(2);
  });

  it("keeps the increment when the transaction commits", async () => {
    const organizationId = newId();

    await withTransaction(async () => {
      await next(organizationId);
    });

    expect(await next(organizationId)).toBe(2);
  });

  it("stores the standard fields and a unique index per organization and key", async () => {
    const organizationId = newId();
    await next(organizationId);

    const collection = connections.tenantShared.db?.collection("sequences");
    const stored = await collection?.findOne({ organizationId });
    const indexes = await collection?.indexes();

    expect(stored).toMatchObject({ organizationId, sequenceKey: "ORDER", nextValue: 1 });
    expect(stored?.["sequenceId"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored?.["createdAt"]).toBeInstanceOf(Date);
    expect(indexes?.some((index) => index.unique === true && "organizationId" in index.key)).toBe(
      true,
    );
  });
});
