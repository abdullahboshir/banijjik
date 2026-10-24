import type {
  CheckInResponse,
  EnrollmentResponse,
  EnrollmentTransitionResponse,
} from "@banijjik/contracts/enrollment";
import type { EnrollmentCreateBody } from "@banijjik/validation/enrollment";
import { apiFetch } from "../lib/api/api-client";

function enrollmentsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/enrollments${suffix}`;
}

/** `POST …/enrollments`; the same key on a retry gives the same enrollment. */
export async function createEnrollment(
  organizationId: string,
  body: EnrollmentCreateBody,
  idempotencyKey: string,
): Promise<EnrollmentResponse> {
  const result = await apiFetch<EnrollmentResponse>(enrollmentsPath(organizationId), {
    method: "POST",
    body,
    idempotencyKey,
  });
  return result.data;
}

/** `POST …/enrollments/{id}/{action}` with the version read; a stale version answers 409. */
export async function transitionEnrollment(input: {
  organizationId: string;
  enrollmentId: string;
  action: string;
  version: number;
  idempotencyKey: string;
}): Promise<EnrollmentTransitionResponse> {
  const result = await apiFetch<EnrollmentTransitionResponse>(
    enrollmentsPath(input.organizationId, `/${input.enrollmentId}/${input.action}`),
    { method: "POST", body: { version: input.version }, idempotencyKey: input.idempotencyKey },
  );
  return result.data;
}

export async function recordCheckIn(
  organizationId: string,
  body: { locationId: string; contactId: string },
  idempotencyKey: string,
): Promise<CheckInResponse> {
  const result = await apiFetch<CheckInResponse>(`/orgs/${organizationId}/check-ins`, {
    method: "POST",
    body,
    idempotencyKey,
  });
  return result.data;
}
