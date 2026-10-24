import type {
  CheckInResponse,
  EnrollmentDetailResponse,
  EnrollmentResponse,
} from "@banijjik/contracts/enrollment";
import type { EnrollmentCreateBody } from "@banijjik/validation/enrollment";
import { apiFetch } from "../lib/api/api-client";
import { newId } from "@banijjik/ids";

const base = (organizationId: string) => `/orgs/${organizationId}`;
export async function listEnrollments(
  organizationId: string,
  query = "limit=100",
): Promise<EnrollmentResponse[]> {
  return (await apiFetch<EnrollmentResponse[]>(`${base(organizationId)}/enrollments?${query}`))
    .data;
}
export async function getEnrollment(
  organizationId: string,
  enrollmentId: string,
): Promise<EnrollmentDetailResponse> {
  return (
    await apiFetch<EnrollmentDetailResponse>(`${base(organizationId)}/enrollments/${enrollmentId}`)
  ).data;
}
export async function createEnrollment(
  organizationId: string,
  body: EnrollmentCreateBody,
): Promise<EnrollmentResponse> {
  return (
    await apiFetch<EnrollmentResponse>(`${base(organizationId)}/enrollments`, {
      method: "POST",
      body,
      idempotencyKey: newId(),
    })
  ).data;
}
export async function transitionEnrollment(request: {
  organizationId: string;
  enrollmentId: string;
  action: string;
  version: number;
}): Promise<EnrollmentResponse> {
  const { organizationId, enrollmentId, action, version } = request;
  return (
    await apiFetch<{ enrollment: EnrollmentResponse }>(
      `${base(organizationId)}/enrollments/${enrollmentId}/${action}`,
      { method: "POST", body: { version }, idempotencyKey: newId() },
    )
  ).data.enrollment;
}
export async function listCheckIns(
  organizationId: string,
  date: string,
): Promise<CheckInResponse[]> {
  return (
    await apiFetch<CheckInResponse[]>(
      `${base(organizationId)}/check-ins?checkedInOn=${date}&limit=100`,
    )
  ).data;
}
export async function recordCheckIn(
  organizationId: string,
  body: { locationId: string; contactId: string; enrollmentId?: string },
): Promise<CheckInResponse> {
  return (
    await apiFetch<CheckInResponse>(`${base(organizationId)}/check-ins`, { method: "POST", body })
  ).data;
}
