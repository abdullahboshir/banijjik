import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callApi } from "../../test-support/auth-api-client.js";
import { registerIamApiModels, startIamApi } from "../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../test-support/iam-api-harness.js";
import {
  buildTenantProbeRouter,
  registerTenantNoteModel,
} from "../../test-support/tenant-probe.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../test-support/two-organizations.js";

registerIamApiModels();
registerTenantNoteModel();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ tenantRouters: [buildTenantProbeRouter()] });
});

afterAll(async () => {
  await harness.dispose();
});

function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

function organizationsCollection() {
  return harness.connections.platform.collection("organizations");
}

describe("tenant context", () => {
  it("gives the owner the organization, the member id and every location", async () => {
    const world = await aWorld();

    const response = await world.alice.call("get", `/orgs/${world.organizationA}/probe`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      organizationId: world.organizationA,
      allowedLocationIds: "ALL",
    });
    expect(typeof response.body.data.memberId).toBe("string");
  });

  it("gives staff only their assigned locations", async () => {
    const world = await aWorld();

    const response = await world.sam.call("get", `/orgs/${world.organizationA}/probe`);

    expect(response.body.data).toMatchObject({
      memberId: world.samMemberId,
      allowedLocationIds: [world.locationA1],
    });
  });

  it("answers an identical 404 for another organization, an unknown one and a malformed one", async () => {
    const world = await aWorld();

    const foreign = await world.alice.call("get", `/orgs/${world.organizationB}/probe`);
    const unknown = await world.alice.call("get", `/orgs/${newId()}/probe`);
    const malformed = await world.alice.call("get", "/orgs/not-a-uuid/probe");

    for (const response of [foreign, unknown, malformed]) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    }
    const withoutRequestId = (response: { body: { error: object } }): object => ({
      ...response.body.error,
      requestId: undefined,
    });
    expect(withoutRequestId(foreign)).toEqual(withoutRequestId(unknown));
    expect(withoutRequestId(foreign)).toEqual(withoutRequestId(malformed));
  });

  it("answers 401 without a session", async () => {
    const world = await aWorld();

    const response = await callApi(harness.app, {
      method: "get",
      path: `/api/v1/orgs/${world.organizationA}/probe`,
    });

    expect(response.status).toBe(401);
  });

  it("answers 404 for a removed member and for a suspended member", async () => {
    const world = await aWorld();
    const members = harness.connections.platform.collection("members");

    await members.updateOne({ memberId: world.samMemberId }, { $set: { status: "REMOVED" } });
    const removed = await world.sam.call("get", `/orgs/${world.organizationA}/probe`);
    await members.updateOne({ memberId: world.samMemberId }, { $set: { status: "SUSPENDED" } });
    const suspended = await world.sam.call("get", `/orgs/${world.organizationA}/probe`);

    expect(removed.status).toBe(404);
    expect(suspended.status).toBe(404);
  });

  it("answers 403 ORG_SUSPENDED for a suspended organization and 404 for a closed one", async () => {
    const world = await aWorld();
    const path = `/orgs/${world.organizationA}/probe`;

    await organizationsCollection().updateOne(
      { organizationId: world.organizationA },
      { $set: { status: "SUSPENDED" } },
    );
    const suspended = await world.alice.call("get", path);
    await organizationsCollection().updateOne(
      { organizationId: world.organizationA },
      { $set: { status: "CLOSED" } },
    );
    const closed = await world.alice.call("get", path);

    expect(suspended.status).toBe(403);
    expect(suspended.body.error.code).toBe("ORG_SUSPENDED");
    expect(closed.status).toBe(404);
  });
});

describe("location access", () => {
  it("answers 403 LOCATION_FORBIDDEN for ?location of a location the member is not assigned to", async () => {
    const world = await aWorld();
    const base = `/orgs/${world.organizationA}/probe`;

    const forbidden = await world.sam.call("get", `${base}?location=${world.locationA2}`);
    const allowed = await world.sam.call("get", `${base}?location=${world.locationA1}`);
    const owner = await world.alice.call("get", `${base}?location=${world.locationA2}`);

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("LOCATION_FORBIDDEN");
    expect(allowed.status).toBe(200);
    expect(owner.status).toBe(200);
  });

  it("answers 400 for a malformed location id", async () => {
    const world = await aWorld();

    const response = await world.alice.call("get", `/orgs/${world.organizationA}/probe?location=x`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses a write into another location and lists only the assigned location", async () => {
    const world = await aWorld();
    const notes = `/orgs/${world.organizationA}/notes`;
    await world.alice.call("post", notes, { label: "in-l1", locationId: world.locationA1 });
    await world.alice.call("post", notes, { label: "in-l2", locationId: world.locationA2 });

    const forbidden = await world.sam.call("post", notes, {
      label: "sneaky",
      locationId: world.locationA2,
    });
    const allowed = await world.sam.call("post", notes, {
      label: "sam-note",
      locationId: world.locationA1,
    });
    const listed = await world.sam.call("get", notes);

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("LOCATION_FORBIDDEN");
    expect(allowed.status).toBe(201);
    const labels = (listed.body.data as { label: string }[]).map((note) => note.label).sort();
    expect(labels).toEqual(["in-l1", "sam-note"]);
  });

  it("refuses to move a note into another location and cannot touch notes there", async () => {
    const world = await aWorld();
    const notes = `/orgs/${world.organizationA}/notes`;
    const mine = await world.alice.call("post", notes, {
      label: "a",
      locationId: world.locationA1,
    });
    const theirs = await world.alice.call("post", notes, {
      label: "b",
      locationId: world.locationA2,
    });

    const move = await world.sam.call("patch", `${notes}/${mine.body.data.noteId}`, {
      locationId: world.locationA2,
    });
    const edit = await world.sam.call("patch", `${notes}/${theirs.body.data.noteId}`, {
      label: "x",
    });
    const remove = await world.sam.call("delete", `${notes}/${theirs.body.data.noteId}`);

    expect(move.status).toBe(403);
    expect(edit.status).toBe(404);
    expect(remove.status).toBe(404);
  });
});

describe("data isolation end to end", () => {
  it("lets neither organization read, change or delete the rows of the other", async () => {
    const world = await aWorld();
    const aNotes = `/orgs/${world.organizationA}/notes`;
    const bNotes = `/orgs/${world.organizationB}/notes`;
    const aNote = await world.alice.call("post", aNotes, {
      label: "alice",
      locationId: world.locationA1,
    });
    const bNote = await world.bob.call("post", bNotes, {
      label: "bob",
      locationId: world.locationB1,
    });
    const aNoteId = aNote.body.data.noteId as string;
    const bNoteId = bNote.body.data.noteId as string;

    const aList = await world.alice.call("get", aNotes);
    const bList = await world.bob.call("get", bNotes);
    const aReachesB = await world.alice.call("patch", `${bNotes}/${bNoteId}`, { label: "hacked" });
    const aReachesBThroughOwnPath = await world.alice.call("patch", `${aNotes}/${bNoteId}`, {
      label: "hacked",
    });
    const aDeletesB = await world.alice.call("delete", `${aNotes}/${bNoteId}`);
    const bDeletesA = await world.bob.call("delete", `${bNotes}/${aNoteId}`);

    expect((aList.body.data as { label: string }[]).map((note) => note.label)).toEqual(["alice"]);
    expect((bList.body.data as { label: string }[]).map((note) => note.label)).toEqual(["bob"]);
    expect(aReachesB.status).toBe(404);
    expect(aReachesBThroughOwnPath.status).toBe(404);
    expect(aDeletesB.status).toBe(404);
    expect(bDeletesA.status).toBe(404);
    const stored = await harness.connections.tenantShared
      .collection("tenant_notes")
      .find({ noteId: { $in: [aNoteId, bNoteId] } })
      .toArray();
    expect(stored.map((note) => note["label"]).sort()).toEqual(["alice", "bob"]);
  });

  it("stamps the organization of the path on new rows", async () => {
    const world = await aWorld();

    const response = await world.alice.call("post", `/orgs/${world.organizationA}/notes`, {
      label: "stamped",
      locationId: world.locationA1,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.organizationId).toBe(world.organizationA);
  });
});
