import { SYSTEM_REASON, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asSystemPort } from "../../../../kernel/context/index.js";
import {
  initializeModels,
  withTransaction,
  type DatabaseConnections,
} from "../../../../kernel/db/index.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../../test-support/test-databases.js";
import { Role } from "../domain/role.entity.js";
import { MongoRoleRepository } from "./mongo-role.repository.js";
import { registerIamModels } from "./register-iam-models.js";

registerIamModels();

const NOW = new Date("2026-10-11T08:00:00.000Z");
// Roles of several organizations are written and read together here, which only system access may do.
const roles = asSystemPort(SYSTEM_REASON.SEED, new MongoRoleRepository());

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

function systemRoles(organizationId: OrganizationId): Role[] {
  const createdByUserId = newId() as UserId;
  return Object.values(SYSTEM_ROLE_KEY).map((roleKey) =>
    Role.createSystem({ organizationId, roleKey, createdByUserId, now: NOW }),
  );
}

describe("MongoRoleRepository", () => {
  it("stores the roles of an organization and reads role keys back without Mongo internals", async () => {
    const organizationId = newId() as OrganizationId;
    const created = systemRoles(organizationId);
    await roles.insertMany(created);

    const keys = await roles.findRoleKeysByIds(
      [organizationId],
      created.map((role) => role.roleId),
    );

    expect(keys.size).toBe(6);
    expect([...keys.values()].sort()).toEqual(Object.values(SYSTEM_ROLE_KEY).sort());
  });

  it("never returns a role of another organization, even when its id is asked for", async () => {
    const mine = newId() as OrganizationId;
    const theirs = newId() as OrganizationId;
    const myRoles = systemRoles(mine);
    const theirRoles = systemRoles(theirs);
    await roles.insertMany([...myRoles, ...theirRoles]);

    const keys = await roles.findRoleKeysByIds(
      [mine],
      theirRoles.map((role) => role.roleId),
    );

    expect(keys.size).toBe(0);
  });

  it("refuses a second role with the same key in one organization", async () => {
    const organizationId = newId() as OrganizationId;
    await roles.insertMany(systemRoles(organizationId));

    await expect(roles.insertMany(systemRoles(organizationId))).rejects.toThrow();
  });

  it("rolls the roles back with the surrounding transaction", async () => {
    const organizationId = newId() as OrganizationId;
    const created = systemRoles(organizationId);

    await expect(
      withTransaction(async () => {
        await roles.insertMany(created);
        throw new Error("abort after the roles were written");
      }),
    ).rejects.toThrow("abort after");

    const keys = await roles.findRoleKeysByIds(
      [organizationId],
      created.map((role) => role.roleId),
    );
    expect(keys.size).toBe(0);
  });
});
