import { MODULE_KEY, MODULE_OVERRIDE_EFFECT } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import type { Express } from "express";
import type { ApiActor, TwoOrganizations } from "./two-organizations.js";
import { writeModuleOverride } from "./entitlement-world.js";
import { enableDirectoryForWorld } from "./directory-world.js";
import { asCustomerCookies, callStorefront, type SignedInCustomer } from "./storefront-world.js";
import type { Response } from "supertest";

/** The credit module is OPTIONAL and depends on directory; tests grant both. */
export async function enableCreditForWorld(world: TwoOrganizations): Promise<void> {
  await enableDirectoryForWorld(world);
  for (const organizationId of [world.organizationA, world.organizationB]) {
    await writeModuleOverride({
      organizationId,
      moduleKey: MODULE_KEY.CREDIT,
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
    });
  }
}

export async function disableCreditModule(organizationId: string): Promise<void> {
  await writeModuleOverride({
    organizationId,
    moduleKey: MODULE_KEY.CREDIT,
    effect: MODULE_OVERRIDE_EFFECT.TENANT_DISABLE,
  });
}

export function ownerOf(world: TwoOrganizations, organizationId: string): ApiActor {
  return organizationId === world.organizationA ? world.alice : world.bob;
}

export function adjustPath(organizationId: string, customerAccountId: string): string {
  return `/orgs/${organizationId}/credit/accounts/${customerAccountId}/adjust`;
}

export function accountPath(organizationId: string, customerAccountId: string): string {
  return `/orgs/${organizationId}/credit/accounts/${customerAccountId}`;
}

/** Adjusts as the organization OWNER (no approval token, M.4 decision 6). */
export async function grantCredits(input: {
  world: TwoOrganizations;
  organizationId: string;
  customerAccountId: string;
  credits: number;
}): Promise<Response> {
  return ownerOf(input.world, input.organizationId).call(
    "post",
    adjustPath(input.organizationId, input.customerAccountId),
    { credits: input.credits, reason: "test grant" },
  );
}

export function customerAccountIdOf(customer: SignedInCustomer): string {
  return customer.verifyResponse.body.data.customerAccountId as string;
}

export async function unlock(input: {
  app: Express;
  organizationId: string;
  customer: SignedInCustomer;
  listingNumber: string;
  idempotencyKey?: string | null;
}): Promise<Response> {
  const { app, organizationId, customer, listingNumber, idempotencyKey = newId() } = input;
  return callStorefront(app, {
    method: "post",
    organizationId,
    suffix: `/listings/${listingNumber}/unlock`,
    cookies: asCustomerCookies(customer.session),
    idempotencyKey,
  });
}

export async function searchListings(
  app: Express,
  organizationId: string,
  customer?: SignedInCustomer,
): Promise<Response> {
  return callStorefront(app, {
    method: "get",
    organizationId,
    suffix: "/listings",
    ...(customer === undefined ? {} : { cookies: asCustomerCookies(customer.session) }),
  });
}

export interface ApprovedListing {
  readonly listingId: string;
  readonly listingNumber: string;
}

/** Creates, submits and approves a listing owned by `owner` through the real directory API. */
export async function createApprovedListing(input: {
  readonly app: Express;
  readonly world: TwoOrganizations;
  readonly organizationId: string;
  readonly owner: SignedInCustomer;
  readonly customFields: Record<string, unknown>;
}): Promise<ApprovedListing> {
  const { app, world, organizationId, owner, customFields } = input;
  const cookies = asCustomerCookies(owner.session);
  const created = await callStorefront(app, {
    method: "put",
    organizationId,
    suffix: "/my/listing",
    cookies,
    body: { customFields },
  });
  if (created.status !== 200) {
    throw new Error(`listing create failed: ${created.status} ${JSON.stringify(created.body)}`);
  }
  const submitted = await callStorefront(app, {
    method: "post",
    organizationId,
    suffix: "/my/listing/submit",
    cookies,
    body: { consents: [] },
  });
  if (submitted.status !== 200) {
    throw new Error(`listing submit failed: ${submitted.status} ${JSON.stringify(submitted.body)}`);
  }
  const queue = await ownerOf(world, organizationId).call(
    "get",
    `/orgs/${organizationId}/directory/queue?status=SUBMITTED`,
  );
  if (queue.status !== 200) throw new Error(`queue failed: ${queue.status}`);
  const row = (queue.body.data.items as readonly { listingId: string; version: number }[]).find(
    (item) => item.listingId === created.body.data.listingId,
  );
  if (row === undefined) throw new Error("submitted listing missing from the queue");
  const approved = await ownerOf(world, organizationId).call(
    "post",
    `/orgs/${organizationId}/directory/listings/${row.listingId}/approve`,
    { version: row.version },
  );
  if (approved.status !== 200) {
    throw new Error(`approve failed: ${approved.status} ${JSON.stringify(approved.body)}`);
  }
  return {
    listingId: created.body.data.listingId as string,
    listingNumber: created.body.data.listingNumber as string,
  };
}
