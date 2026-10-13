import {
  ACCESS_TOKEN_COOKIE_NAME,
  PLATFORM_AUDIT_ACTION,
  PLATFORM_ROLE,
  USER_STATUS,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asCookies, callApi } from "../../../../test-support/auth-api-client.js";
import { registerViaApi } from "../../../../test-support/auth-api-scenarios.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  createOrganizationAs,
  newActor,
} from "../../../../test-support/organization-tenant-world.js";
import {
  asPlatformCookies,
  createPlatformActor,
  platformLogin,
  readPlatformCookies,
  type PlatformActor,
} from "../../../../test-support/platform-world.js";

registerIamApiModels();

let harness: IamApiHarness;
let superAdmin: PlatformActor;

beforeAll(async () => {
  harness = await startIamApi();
  superAdmin = await createPlatformActor(harness.app, harness.connections, [
    PLATFORM_ROLE.SUPER_ADMIN,
  ]);
});

afterAll(async () => {
  await harness.dispose();
});

const REASON = "covering the night queue";

function grant(identifier: string, platformRoles: string[]) {
  return superAdmin.call("post", "/operators", { identifier, platformRoles, reason: REASON });
}

async function auditOf(targetId: string) {
  const rows = await harness.connections.platform
    .collection("platform_audit_logs")
    .find({ targetId })
    .toArray();
  return rows.map((row) => ({
    action: row["action"],
    reason: row["reason"],
    changes: row["changes"],
  }));
}

describe("platform operators", () => {
  it("lists, grants, re-roles, disables and enables, and audits each write once", async () => {
    const person = await registerViaApi(harness.app);
    const created = await grant(person.email, [PLATFORM_ROLE.SUPPORT]);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: "Rahim Uddin",
      identifierHint: `${person.email.slice(0, 1)}***@${person.email.split("@")[1]}`,
      platformRoles: [PLATFORM_ROLE.SUPPORT],
      status: USER_STATUS.ACTIVE,
      version: 1,
      userId: person.me.userId,
    });
    const operatorId = created.body.data.platformOperatorId as string;

    const listed = await superAdmin.call("get", "/operators?status=ACTIVE&limit=100");
    expect(listed.status).toBe(200);
    expect(listed.body.meta).toMatchObject({ page: 1, limit: 100, hasNext: false });
    expect(
      listed.body.data.map((row: { platformOperatorId: string }) => row.platformOperatorId),
    ).toContain(operatorId);

    const read = await superAdmin.call("get", `/operators/${operatorId}`);
    expect(read.body.data.identifierHint).toBe(created.body.data.identifierHint);

    const same = await superAdmin.call("patch", `/operators/${operatorId}`, {
      platformRoles: [PLATFORM_ROLE.SUPPORT],
      version: 1,
      reason: REASON,
    });
    expect(same.status).toBe(200);
    expect(same.body.data.version).toBe(1);

    const changed = await superAdmin.call("patch", `/operators/${operatorId}`, {
      platformRoles: [PLATFORM_ROLE.BILLING],
      version: 1,
      reason: REASON,
    });
    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({ platformRoles: [PLATFORM_ROLE.BILLING], version: 2 });

    const disabled = await superAdmin.call("post", `/operators/${operatorId}/disable`, {
      version: 2,
      reason: REASON,
    });
    expect(disabled.body.data).toMatchObject({ status: USER_STATUS.DISABLED, version: 3 });
    const stillDisabled = await superAdmin.call("post", `/operators/${operatorId}/disable`, {
      version: 3,
      reason: REASON,
    });
    expect(stillDisabled.body.data.version).toBe(3);

    const enabled = await superAdmin.call("post", `/operators/${operatorId}/enable`, {
      version: 3,
      reason: REASON,
    });
    expect(enabled.body.data).toMatchObject({ status: USER_STATUS.ACTIVE, version: 4 });

    const actions = (await auditOf(operatorId)).map((entry) => entry.action);
    expect(actions).toEqual([
      PLATFORM_AUDIT_ACTION.OPERATOR_CREATED,
      PLATFORM_AUDIT_ACTION.OPERATOR_ROLES_CHANGED,
      PLATFORM_AUDIT_ACTION.OPERATOR_DISABLED,
      PLATFORM_AUDIT_ACTION.OPERATOR_ENABLED,
    ]);
    expect((await auditOf(operatorId))[0]).toMatchObject({
      reason: REASON,
      changes: { userId: { to: person.me.userId }, platformRoles: { to: [PLATFORM_ROLE.SUPPORT] } },
    });
  });

  it("applies a role change and a disable on the operator's next request", async () => {
    const owner = await newActor(harness.app);
    const { organizationId } = await createOrganizationAs(owner, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const person = await registerViaApi(harness.app);
    const created = await grant(person.email, [PLATFORM_ROLE.SUPPORT]);
    const operatorId = created.body.data.platformOperatorId as string;
    const login = await platformLogin(harness.app, person);
    const session = readPlatformCookies(login);
    const asOperator = (method: "get" | "post", path: string, body?: object) =>
      callApi(harness.app, {
        method,
        path: `/api/v1/platform${path}`,
        cookies: asPlatformCookies(session),
        ...(body === undefined ? {} : { body }),
      });

    const suspended = await asOperator("post", `/organizations/${organizationId}/suspend`, {
      reason: REASON,
    });
    expect(suspended.status).toBe(200);

    await superAdmin.call("patch", `/operators/${operatorId}`, {
      platformRoles: [PLATFORM_ROLE.BILLING],
      version: 1,
      reason: REASON,
    });
    const denied = await asOperator("post", `/organizations/${organizationId}/suspend`, {
      reason: REASON,
    });
    expect(denied.status).toBe(403);
    const extension = await asOperator(
      "post",
      `/organizations/${organizationId}/subscription/extend-trial`,
      { days: 3, reason: REASON },
    );
    expect(extension.status).not.toBe(403);

    await superAdmin.call("post", `/operators/${operatorId}/disable`, {
      version: 2,
      reason: REASON,
    });
    const next = await asOperator("get", "/me");
    expect(next.status).toBe(401);
    const refresh = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/platform/auth/refresh",
      cookies: asPlatformCookies(session),
    });
    expect(refresh.status).toBe(401);
    const adminRefresh = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/refresh",
      cookies: asCookies(person.session),
    });
    expect(adminRefresh.status).toBe(204);

    await superAdmin.call("post", `/operators/${operatorId}/enable`, {
      version: 3,
      reason: REASON,
    });
    const again = await platformLogin(harness.app, person);
    expect(again.status).toBe(200);
  });
});

describe("platform operator refusals", () => {
  it("answers 400 for a bad body or id, at the field", async () => {
    const cases: {
      path: string;
      method: "post" | "patch" | "get";
      body?: object;
      field: string;
      messageKey?: string;
    }[] = [
      {
        method: "post",
        path: "/operators",
        body: {
          identifier: "a@b.co",
          platformRoles: ["SUPPORT"],
          reason: REASON,
          extra: 1,
        },
        field: "",
        messageKey: "validation.unrecognized_keys",
      },
      {
        method: "post",
        path: "/operators",
        body: { identifier: "a@b.co", platformRoles: [], reason: REASON },
        field: "platformRoles",
      },
      {
        method: "post",
        path: "/operators",
        body: { identifier: "a@b.co", platformRoles: ["OWNER"], reason: REASON },
        field: "platformRoles",
      },
      {
        method: "post",
        path: "/operators",
        body: { identifier: "a@b.co", platformRoles: ["SUPPORT", "SUPPORT"], reason: REASON },
        field: "platformRoles",
      },
      {
        method: "post",
        path: "/operators",
        body: { identifier: "a@b.co", platformRoles: ["SUPPORT"] },
        field: "reason",
      },
      {
        method: "post",
        path: "/operators",
        body: { identifier: "not a phone", platformRoles: ["SUPPORT"], reason: REASON },
        field: "identifier",
      },
      { method: "get", path: "/operators/not-a-uuid", field: "platformOperatorId" },
    ];
    for (const item of cases) {
      const response = await superAdmin.call(item.method, item.path, item.body);
      expect(response.status, `${item.field} ${JSON.stringify(response.body)}`).toBe(400);
      const fields = (response.body.error?.details?.fields ?? []) as {
        path: string;
        messageKey: string;
      }[];
      const matched = fields.some(
        (field) =>
          (item.messageKey === undefined || field.messageKey === item.messageKey) &&
          (field.path === item.field || field.path.startsWith(`${item.field}.`)),
      );
      expect(matched, `${item.field} ${JSON.stringify(fields)}`).toBe(true);
    }
  });

  it("answers 403 to support and billing, and 401 without a platform session", async () => {
    const support = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);
    const billing = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.BILLING,
    ]);
    const routes: { method: "get" | "post" | "patch"; path: string; body?: object }[] = [
      { method: "get", path: "/operators" },
      {
        method: "post",
        path: "/operators",
        body: { identifier: "a@b.co", platformRoles: ["SUPPORT"], reason: REASON },
      },
      { method: "get", path: `/operators/${newId()}` },
      {
        method: "patch",
        path: `/operators/${newId()}`,
        body: { platformRoles: ["SUPPORT"], version: 1, reason: REASON },
      },
      {
        method: "post",
        path: `/operators/${newId()}/disable`,
        body: { version: 1, reason: REASON },
      },
      {
        method: "post",
        path: `/operators/${newId()}/enable`,
        body: { version: 1, reason: REASON },
      },
    ];
    for (const actor of [support, billing]) {
      for (const route of routes) {
        const response = await actor.call(route.method, route.path, route.body);
        expect(response.status, route.path).toBe(403);
      }
    }
    const missing = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/platform/operators",
    });
    expect(missing.status).toBe(401);
    const adminCookie = await registerViaApi(harness.app);
    const adminAudience = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/platform/operators",
      cookies: { [ACCESS_TOKEN_COOKIE_NAME]: adminCookie.session.access },
    });
    expect(adminAudience.status).toBe(401);
  });

  it("refuses a missing user, an inactive user, a second grant, a stale version, an unknown id and the caller's own record", async () => {
    const missing = await grant("nobody@example.com", [PLATFORM_ROLE.SUPPORT]);
    expect(missing.body.error).toMatchObject({
      code: "BUSINESS_RULE",
      details: { ruleKey: "OPERATOR_USER_NOT_FOUND" },
    });

    const locked = await registerViaApi(harness.app);
    await harness.connections.platform
      .collection("users")
      .updateOne({ userId: locked.me.userId }, { $set: { status: USER_STATUS.LOCKED } });
    const lockedGrant = await grant(locked.email, [PLATFORM_ROLE.SUPPORT]);
    expect(lockedGrant.body.error.details.ruleKey).toBe("OPERATOR_USER_NOT_ACTIVE");

    const disabled = await registerViaApi(harness.app);
    await harness.connections.platform
      .collection("users")
      .updateOne({ userId: disabled.me.userId }, { $set: { status: USER_STATUS.DISABLED } });
    expect((await grant(disabled.email, [PLATFORM_ROLE.SUPPORT])).body.error.details.ruleKey).toBe(
      "OPERATOR_USER_NOT_ACTIVE",
    );

    const again = await grant(superAdmin.person.email, [PLATFORM_ROLE.BILLING]);
    expect(again.status).toBe(409);
    expect(again.body.error.messageKey).toBe("errors.operator_exists");

    const stale = await superAdmin.call("patch", `/operators/${superAdmin.platformOperatorId}`, {
      platformRoles: [PLATFORM_ROLE.BILLING],
      version: 99,
      reason: REASON,
    });
    expect(stale.status).toBe(422);
    expect(stale.body.error.details.ruleKey).toBe("OWN_OPERATOR_ACCESS");

    const unknown = await superAdmin.call("get", `/operators/${newId()}`);
    expect(unknown.status).toBe(404);

    const person = await registerViaApi(harness.app);
    const created = await grant(person.email, [PLATFORM_ROLE.SUPPORT]);
    const operatorId = created.body.data.platformOperatorId as string;
    const conflict = await superAdmin.call("patch", `/operators/${operatorId}`, {
      platformRoles: [PLATFORM_ROLE.BILLING],
      version: 9,
      reason: REASON,
    });
    expect(conflict.status).toBe(409);

    for (const call of [
      () =>
        superAdmin.call("post", `/operators/${superAdmin.platformOperatorId}/disable`, {
          version: 1,
          reason: REASON,
        }),
      () =>
        superAdmin.call("post", `/operators/${superAdmin.platformOperatorId}/enable`, {
          version: 1,
          reason: REASON,
        }),
    ]) {
      const response = await call();
      expect(response.status).toBe(422);
      expect(response.body.error.details.ruleKey).toBe("OWN_OPERATOR_ACCESS");
    }
  });

  it("lets exactly one of two super admins disable the other", async () => {
    const first = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPER_ADMIN,
    ]);
    const second = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPER_ADMIN,
    ]);
    const [left, right] = await Promise.all([
      first.call("post", `/operators/${second.platformOperatorId}/disable`, {
        version: 1,
        reason: REASON,
      }),
      second.call("post", `/operators/${first.platformOperatorId}/disable`, {
        version: 1,
        reason: REASON,
      }),
    ]);
    const statuses = [left.status, right.status].sort();
    expect(statuses).toEqual([200, 403]);
    const rows = await harness.connections.platform
      .collection("platform_operators")
      .find({ platformOperatorId: { $in: [first.platformOperatorId, second.platformOperatorId] } })
      .toArray();
    const active = rows.filter((row) => row["status"] === USER_STATUS.ACTIVE);
    expect(active).toHaveLength(1);
    expect(active[0]?.["platformRoles"]).toContain(PLATFORM_ROLE.SUPER_ADMIN);
    const audits = await harness.connections.platform
      .collection("platform_audit_logs")
      .find({
        targetId: { $in: [first.platformOperatorId, second.platformOperatorId] },
        action: PLATFORM_AUDIT_ACTION.OPERATOR_DISABLED,
      })
      .toArray();
    expect(audits).toHaveLength(1);
  });

  it("answers one 201 and one 409 when two grants race for one user", async () => {
    const person = await registerViaApi(harness.app);
    const [left, right] = await Promise.all([
      grant(person.email, [PLATFORM_ROLE.SUPPORT]),
      grant(person.email, [PLATFORM_ROLE.BILLING]),
    ]);
    expect([left.status, right.status].sort()).toEqual([201, 409]);
    expect([left, right].find((response) => response.status === 409)?.body.error.messageKey).toBe(
      "errors.operator_exists",
    );
  });
});
