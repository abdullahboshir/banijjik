import { asId, newId, type OrganizationId, type SiteDomainId } from "@banijjik/ids";
import { ERROR_CODE } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseConnections } from "../../../../kernel/db/index.js";
import { initializeModels, models } from "../../../../kernel/db/index.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../../test-support/test-databases.js";
import type { HostClaims } from "../application/host-claims.js";
import {
  HostClaimGenerationMismatchError,
  HostClaimQuarantinedError,
  HostClaimTakenError,
} from "../domain/errors.js";
import { HOST_CLAIM_QUARANTINE_MS } from "../domain/host-claim.entity.js";
import { createMongoHostClaims } from "./mongo-host-claims.js";
import { HOST_CLAIM_MODEL_NAME, type HostClaimDocument } from "./host-claim.schema.js";
import { registerOperationsModels } from "./register-operations-models.js";

const RESERVATIONS = {
  baseDomain: "sites.example.com",
  reservedHostnames: ["api.sites.example.com", "admin.sites.example.com"],
};

let connections: DatabaseConnections;
let claims: HostClaims;

function anOrganizationId(): OrganizationId {
  return asId<OrganizationId>(newId());
}

function aSiteDomainId(): SiteDomainId {
  return asId<SiteDomainId>(newId());
}

function claimRows() {
  return models({}).get<HostClaimDocument>(HOST_CLAIM_MODEL_NAME);
}

beforeAll(async () => {
  installTestLogger();
  registerOperationsModels();
  connections = await connectTestDatabases();
  await initializeModels();
  claims = createMongoHostClaims(RESERVATIONS);
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

describe("MongoHostClaims.reserve", () => {
  it("gives exactly one claim to two organizations racing for one hostname", async () => {
    const hostname = "race.sites.example.com";
    const first = { organizationId: anOrganizationId(), siteDomainId: aSiteDomainId() };
    const second = { organizationId: anOrganizationId(), siteDomainId: aSiteDomainId() };

    const results = await Promise.allSettled([
      claims.reserve({ hostname, operationGeneration: 1, ...first }),
      claims.reserve({ hostname, operationGeneration: 1, ...second }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(HostClaimTakenError);

    expect(await claimRows().countDocuments({ hostname })).toBe(1);
    const resolved = await claims.resolve(hostname);
    expect([first.organizationId, second.organizationId]).toContain(resolved?.organizationId);
  });

  it("stores the normalized host and answers it for any casing", async () => {
    const reservation = { organizationId: anOrganizationId(), siteDomainId: aSiteDomainId() };

    await claims.reserve({
      hostname: "  Shop.Mixed-Case.Sites.Example.com. ",
      operationGeneration: 1,
      ...reservation,
    });

    const resolved = await claims.resolve("SHOP.mixed-case.sites.example.com");
    expect(resolved).toEqual({
      organizationId: reservation.organizationId,
      hostname: "shop.mixed-case.sites.example.com",
      domainGeneration: 1,
    });
  });

  it("refuses a reserved platform host and an unparseable one", async () => {
    const reservation = { organizationId: anOrganizationId(), siteDomainId: aSiteDomainId() };

    await expect(
      claims.reserve({ hostname: "api.sites.example.com", operationGeneration: 1, ...reservation }),
    ).rejects.toMatchObject({
      code: ERROR_CODE.VALIDATION_ERROR,
      details: { hostname: "api.sites.example.com" },
    });
    await expect(
      claims.reserve({ hostname: "not a host", operationGeneration: 1, ...reservation }),
    ).rejects.toMatchObject({
      code: ERROR_CODE.VALIDATION_ERROR,
      details: { hostname: "not a host" },
    });
  });

  it("refuses a host another site domain already holds", async () => {
    const hostname = "taken.sites.example.com";
    await claims.reserve({
      hostname,
      operationGeneration: 1,
      organizationId: anOrganizationId(),
      siteDomainId: aSiteDomainId(),
    });

    await expect(
      claims.reserve({
        hostname,
        operationGeneration: 1,
        organizationId: anOrganizationId(),
        siteDomainId: aSiteDomainId(),
      }),
    ).rejects.toBeInstanceOf(HostClaimTakenError);
  });

  it("refuses a stale reserve that would take a newer generation back", async () => {
    const hostname = "stale.sites.example.com";
    const reservation = { organizationId: anOrganizationId(), siteDomainId: aSiteDomainId() };
    await claims.reserve({ hostname, operationGeneration: 2, ...reservation });

    await expect(
      claims.reserve({ hostname, operationGeneration: 1, ...reservation }),
    ).rejects.toBeInstanceOf(HostClaimGenerationMismatchError);

    expect((await claims.resolve(hostname))?.domainGeneration).toBe(2);
  });

  it("lets an explicit retry of the same site domain take the new generation", async () => {
    const hostname = "retry.sites.example.com";
    const reservation = { organizationId: anOrganizationId(), siteDomainId: aSiteDomainId() };

    await claims.reserve({ hostname, operationGeneration: 1, ...reservation });
    await claims.reserve({ hostname, operationGeneration: 2, ...reservation });

    expect((await claims.resolve(hostname))?.domainGeneration).toBe(2);
    expect(await claimRows().countDocuments({ hostname })).toBe(1);
  });
});

describe("MongoHostClaims.resolve", () => {
  it("answers undefined for an unknown or unparseable host", async () => {
    expect(await claims.resolve("nobody.sites.example.com")).toBeUndefined();
    expect(await claims.resolve("not a host")).toBeUndefined();
  });
});

describe("MongoHostClaims.disable", () => {
  it("stops routing at once and quarantines the host against a new claim", async () => {
    const hostname = "remove.sites.example.com";
    const reservation = { organizationId: anOrganizationId(), siteDomainId: aSiteDomainId() };
    await claims.reserve({ hostname, operationGeneration: 1, ...reservation });

    await claims.disable({ siteDomainId: reservation.siteDomainId, operationGeneration: 1 });

    expect(await claims.resolve(hostname)).toBeUndefined();
    await expect(
      claims.reserve({
        hostname,
        operationGeneration: 1,
        organizationId: anOrganizationId(),
        siteDomainId: aSiteDomainId(),
      }),
    ).rejects.toBeInstanceOf(HostClaimQuarantinedError);
  });

  it("lets the host be claimed again once the quarantine has lapsed", async () => {
    const hostname = "lapsed.sites.example.com";
    const first = { organizationId: anOrganizationId(), siteDomainId: aSiteDomainId() };
    await claims.reserve({ hostname, operationGeneration: 1, ...first });
    await claims.disable({ siteDomainId: first.siteDomainId, operationGeneration: 1 });

    const past = new Date(Date.now() - HOST_CLAIM_QUARANTINE_MS);
    await claimRows().updateOne({ hostname }, { $set: { quarantineUntil: past } });

    const second = { organizationId: anOrganizationId(), siteDomainId: aSiteDomainId() };
    await claims.reserve({ hostname, operationGeneration: 1, ...second });

    expect((await claims.resolve(hostname))?.organizationId).toBe(second.organizationId);
    expect(await claimRows().countDocuments({ hostname })).toBe(1);
  });

  it("refuses a late disable of an older generation and keeps the newer claim routing", async () => {
    const hostname = "late.sites.example.com";
    const reservation = { organizationId: anOrganizationId(), siteDomainId: aSiteDomainId() };
    await claims.reserve({ hostname, operationGeneration: 1, ...reservation });
    await claims.reserve({ hostname, operationGeneration: 2, ...reservation });

    await expect(
      claims.disable({ siteDomainId: reservation.siteDomainId, operationGeneration: 1 }),
    ).rejects.toBeInstanceOf(HostClaimGenerationMismatchError);

    expect((await claims.resolve(hostname))?.domainGeneration).toBe(2);
  });

  it("treats a disable of a domain that has no claim as already done", async () => {
    await expect(
      claims.disable({ siteDomainId: aSiteDomainId(), operationGeneration: 1 }),
    ).resolves.toBeUndefined();
  });
});
