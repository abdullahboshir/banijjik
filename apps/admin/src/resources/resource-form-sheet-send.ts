import type { ResourceResponse } from "@banijjik/contracts/booking";
import type { FieldErrors } from "../auth/field-errors";
import { createResource, createResourceTimeOff, updateResource } from "./resource-api";
import { buildResourceCreate, buildResourceUpdate, type ResourceFormState } from "./resource-form";

export async function sendResourceForm(input: {
  organizationId: string;
  form: ResourceFormState;
  existing: ResourceResponse | undefined;
}): Promise<{ ok: true } | { ok: false; fieldErrors: FieldErrors }> {
  const isEdit = input.existing !== undefined;
  if (isEdit && input.existing !== undefined) {
    const built = buildResourceUpdate(input.form, input.existing.version);
    if (!built.ok) return { ok: false, fieldErrors: built.errors };
    await updateResource(input.organizationId, input.existing.resourceId, built.body);
    if (input.form.timeOffStartsAt !== "" && input.form.timeOffEndsAt !== "") {
      await createResourceTimeOff(input.organizationId, input.existing.resourceId, {
        startsAt: new Date(input.form.timeOffStartsAt).toISOString(),
        endsAt: new Date(input.form.timeOffEndsAt).toISOString(),
        ...(input.form.timeOffReason.trim() === ""
          ? {}
          : { reason: input.form.timeOffReason.trim() }),
      });
    }
    return { ok: true };
  }
  const built = buildResourceCreate(input.form);
  if (!built.ok) return { ok: false, fieldErrors: built.errors };
  await createResource(input.organizationId, built.body);
  return { ok: true };
}
