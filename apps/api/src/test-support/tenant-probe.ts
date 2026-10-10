import { DATABASE_KIND, MODEL_TENANCY, PERMISSION_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { Router } from "express";
import { Schema } from "mongoose";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import { getRequestContext } from "../kernel/context/index.js";
import {
  auditFields,
  domainIdField,
  models,
  registerModel,
  SCHEMA_OPTIONS,
  versionField,
} from "../kernel/db/index.js";
import { notFound, sendData } from "../kernel/http/index.js";

export const TENANT_NOTE_MODEL = "TenantNote";

export interface TenantNoteDocument {
  noteId: string;
  organizationId: string;
  locationId: string;
  label: string;
}

const tenantNoteSchema = new Schema(
  {
    ...domainIdField("noteId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true },
    label: { type: String, required: true },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);
tenantNoteSchema.index({ organizationId: 1, noteId: 1 }, { unique: true });

/** A location-scoped test model for the isolation suite. Call once per test file, before connecting. */
export function registerTenantNoteModel(): void {
  registerModel({
    modelName: TENANT_NOTE_MODEL,
    collectionName: "tenant_notes",
    database: DATABASE_KIND.TENANT,
    schema: tenantNoteSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
}

function notes() {
  return models({}).get<TenantNoteDocument>(TENANT_NOTE_MODEL);
}

/**
 * A tenant router that deliberately never names the organization or the caller's locations: it
 * relies on the plugins alone, so what the isolation suite proves is the kernel's doing.
 */
export function buildTenantProbeRouter(): Router {
  const router = Router({ mergeParams: true });
  router.get("/probe", (_request, response) => {
    const { organizationId, memberId, allowedLocationIds } = getRequestContext();
    sendData(response, { organizationId, memberId, allowedLocationIds });
  });
  router.get("/notes", async (_request, response) => {
    const rows = await notes().find().lean();
    sendData(
      response,
      rows.map(({ noteId, label, locationId }) => ({ noteId, label, locationId })),
    );
  });
  router.post("/notes", async (request, response) => {
    const { label, locationId } = request.body as { label: string; locationId: string };
    const created = await notes().create({ noteId: newId(), label, locationId });
    sendData(
      response,
      { noteId: created.noteId, organizationId: created.organizationId },
      { status: 201 },
    );
  });
  router.patch("/notes/:noteId", async (request, response) => {
    const { label, locationId } = request.body as { label?: string; locationId?: string };
    const changes = {
      ...(label === undefined ? {} : { label }),
      ...(locationId === undefined ? {} : { locationId }),
    };
    const result = await notes().updateOne({ noteId: request.params["noteId"] }, { $set: changes });
    if (result.matchedCount === 0) throw notFound();
    sendData(response, { updated: result.modifiedCount });
  });
  router.delete("/notes/:noteId", async (request, response) => {
    const result = await notes().deleteOne({ noteId: request.params["noteId"] });
    if (result.deletedCount === 0) throw notFound();
    sendData(response, { deleted: result.deletedCount });
  });
  return router;
}

/**
 * Routes guarded by `permission(iam.role.read)`: the guard narrows the request's locations, and
 * the note write then relies on the location plugin alone (ADR-088). Used by the RBAC suite.
 */
export function buildPermissionProbeRouter(permission: PermissionMiddlewareFactory): Router {
  const router = Router({ mergeParams: true });
  const guard = permission(PERMISSION_KEY.IAM_ROLE_READ);
  router.get("/guarded/probe", guard, (_request, response) => {
    sendData(response, { allowedLocationIds: getRequestContext().allowedLocationIds });
  });
  router.post("/guarded/notes", guard, async (request, response) => {
    const { label, locationId } = request.body as { label: string; locationId: string };
    const created = await notes().create({ noteId: newId(), label, locationId });
    sendData(response, { noteId: created.noteId }, { status: 201 });
  });
  return router;
}
