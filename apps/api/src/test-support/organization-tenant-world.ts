import type { Express } from "express";
import type { Response } from "supertest";
import type { DatabaseConnections } from "../kernel/db/index.js";
import { registerViaApi } from "./auth-api-scenarios.js";
import { ApiActor } from "./two-organizations.js";

let issuedSlugs = 0;

export interface CreatedOrganization {
  readonly organizationId: string;
  readonly locationId: string;
}

/** Creates a business for the actor through the real endpoint; it starts with one default location. */
export async function createOrganizationAs(
  actor: ApiActor,
  connections: DatabaseConnections,
  /** Extra fields of the create-organization body; the test file supplies them (lint R16). */
  organizationFields: object,
): Promise<CreatedOrganization> {
  issuedSlugs += 1;
  const response = await actor.call("post", "/me/orgs", {
    name: `Tenant ${issuedSlugs}`,
    slug: `tenant-world-${issuedSlugs}`,
    ...organizationFields,
  });
  if (response.status !== 201) throw new Error(`organization failed: ${response.status}`);
  const organizationId = response.body.data.organizationId as string;
  const row = await connections.platform
    .collection("locations")
    .findOne({ organizationId, isDefault: true });
  if (row === null) throw new Error("default location missing");
  return { organizationId, locationId: row["locationId"] as string };
}

export async function newActor(app: Express): Promise<ApiActor> {
  return new ApiActor(app, await registerViaApi(app));
}

/** The last path segment of an `inviteUrlPath` such as `/invitations/<token>`. */
export function tokenOf(inviteUrlPath: string): string {
  return inviteUrlPath.slice(inviteUrlPath.lastIndexOf("/") + 1);
}

export interface InvitedPerson {
  readonly invitationId: string;
  readonly token: string;
  readonly version: number;
}

/** Invites an email address and returns the pieces a test needs; fails loudly if the call is refused. */
export async function inviteEmailAs(
  actor: ApiActor,
  organizationId: string,
  body: { readonly email: string; readonly assignments: readonly object[] },
): Promise<InvitedPerson> {
  const response: Response = await actor.call("post", `/orgs/${organizationId}/invitations`, body);
  if (response.status !== 201) throw new Error(`invite failed: ${response.status}`);
  const data = response.body.data;
  return {
    invitationId: data.invitationId,
    token: tokenOf(data.inviteUrlPath),
    version: data.version,
  };
}

export function countAuditRows(connections: DatabaseConnections, filter: object): Promise<number> {
  return connections.tenantShared.collection("audit_logs").countDocuments(filter);
}

export function countOutboxRows(connections: DatabaseConnections, filter: object): Promise<number> {
  return connections.platform.collection("outbox_events").countDocuments(filter);
}

export interface CustomRoleSpec {
  readonly organizationId: string;
  readonly name: string;
  readonly permissionKeys: readonly string[];
}

export async function createCustomRoleAs(owner: ApiActor, role: CustomRoleSpec): Promise<string> {
  const { organizationId, ...body } = role;
  const response = await owner.call("post", `/orgs/${organizationId}/roles`, body);
  if (response.status !== 201) throw new Error(`role failed: ${response.status}`);
  return response.body.data.roleId as string;
}
