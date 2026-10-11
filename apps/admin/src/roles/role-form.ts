import {
  roleCreateRequestSchema,
  roleUpdateRequestSchema,
  type RoleCreateBody,
  type RoleUpdateBody,
} from "@banijjik/validation";
import type { z } from "zod";
import { issuesToFieldErrors, type FieldErrors } from "../auth/field-errors";

export type RoleFormResult<Body> =
  { ok: true; body: Body } | { ok: false; fieldErrors: FieldErrors };

function fieldErrorsOf(issues: readonly z.core.$ZodIssue[], name: string): FieldErrors {
  return issuesToFieldErrors(issues, { name });
}

/** Checks a new role with the schema the API uses. Repeated keys are collapsed by the schema. */
export function buildRoleCreate(
  name: string,
  permissionKeys: readonly string[],
): RoleFormResult<RoleCreateBody> {
  const parsed = roleCreateRequestSchema.safeParse({ name, permissionKeys });
  if (parsed.success) return { ok: true, body: parsed.data };
  return { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues, name) };
}

export function buildRoleUpdate(
  name: string,
  permissionKeys: readonly string[],
  version: number,
): RoleFormResult<RoleUpdateBody> {
  const parsed = roleUpdateRequestSchema.safeParse({ name, permissionKeys, version });
  if (parsed.success) return { ok: true, body: parsed.data };
  return { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues, name) };
}
