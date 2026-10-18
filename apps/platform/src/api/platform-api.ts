import type {
  LoginRequest,
  PlatformOperatorSummary,
  PlatformChangePackageRequest,
  PlatformExtendTrialRequest,
  PlatformModuleOverrideCreateRequest,
  PlatformModuleOverrideResponse,
  PlatformOrganizationStatusResponse,
  PlatformPackageCreateRequest,
  PlatformPackageResponse,
  PlatformPackageUpdateRequest,
  PlatformReasonRequest,
  PlatformSessionResponse,
  PlatformSubscriptionResponse,
  PlatformDeadLetter,
  PlatformIndustryTemplateDetail,
  PlatformIndustryTemplateSummary,
  PlatformSettingDefinition,
} from "@banijjik/contracts";
import {
  platformOperatorCreateRequestSchema,
  type ChangeIndustryTemplateBody,
  type IndustryTemplateStatusBody,
  type IndustryTemplateUpdateBody,
  type PlatformEventSkipBody,
  type PlatformOperatorStatusBody,
  type PlatformOperatorUpdateBody,
} from "@banijjik/validation";
import type { z } from "zod";
import type { IndustryTemplateCreatePayload } from "../industry-templates/create-payload";
import { apiFetch } from "./platform-api-client";

/** Signs an operator in; the API sets the platform cookies and answers with roles and permissions. */
export async function login(request: LoginRequest): Promise<PlatformSessionResponse> {
  const result = await apiFetch<PlatformSessionResponse>("/platform/auth/login", {
    method: "POST",
    body: request,
  });
  return result.data;
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/platform/auth/logout", { method: "POST" });
}

export type TenantStatusAction = "suspend" | "reactivate";

export async function changeTenantStatus(
  organizationId: string,
  action: TenantStatusAction,
  request: PlatformReasonRequest,
): Promise<PlatformOrganizationStatusResponse> {
  const result = await apiFetch<PlatformOrganizationStatusResponse>(
    `/platform/organizations/${organizationId}/${action}`,
    { method: "POST", body: request },
  );
  return result.data;
}

export async function extendTrial(
  organizationId: string,
  request: PlatformExtendTrialRequest,
): Promise<PlatformSubscriptionResponse> {
  const result = await apiFetch<PlatformSubscriptionResponse>(
    `/platform/organizations/${organizationId}/subscription/extend-trial`,
    { method: "POST", body: request },
  );
  return result.data;
}

export async function changePackage(
  organizationId: string,
  request: PlatformChangePackageRequest,
): Promise<PlatformSubscriptionResponse> {
  const result = await apiFetch<PlatformSubscriptionResponse>(
    `/platform/organizations/${organizationId}/subscription/change-package`,
    { method: "POST", body: request },
  );
  return result.data;
}

export async function createModuleOverride(
  organizationId: string,
  request: PlatformModuleOverrideCreateRequest,
): Promise<PlatformModuleOverrideResponse> {
  const result = await apiFetch<PlatformModuleOverrideResponse>(
    `/platform/organizations/${organizationId}/module-overrides`,
    { method: "POST", body: request },
  );
  return result.data;
}

export async function deleteModuleOverride(
  organizationId: string,
  moduleOverrideId: string,
): Promise<void> {
  await apiFetch<void>(
    `/platform/organizations/${organizationId}/module-overrides/${moduleOverrideId}`,
    { method: "DELETE" },
  );
}

export async function createPackage(
  request: PlatformPackageCreateRequest,
): Promise<PlatformPackageResponse> {
  const result = await apiFetch<PlatformPackageResponse>("/platform/packages", {
    method: "POST",
    body: request,
  });
  return result.data;
}

export async function updatePackage(
  packageId: string,
  request: PlatformPackageUpdateRequest,
): Promise<PlatformPackageResponse> {
  const result = await apiFetch<PlatformPackageResponse>(`/platform/packages/${packageId}`, {
    method: "PATCH",
    body: request,
  });
  return result.data;
}

/** Queues a failed handler job again with fresh attempts (card 3.8a). */
export async function replayDeadLetter(eventDeadLetterId: string): Promise<PlatformDeadLetter> {
  const result = await apiFetch<PlatformDeadLetter>(
    `/platform/event-dead-letters/${eventDeadLetterId}/replay`,
    { method: "POST" },
  );
  return result.data;
}

/** Gives up on a failed handler job; the reason goes to the platform audit log. */
export async function skipDeadLetter(
  eventDeadLetterId: string,
  request: PlatformEventSkipBody,
): Promise<PlatformDeadLetter> {
  const result = await apiFetch<PlatformDeadLetter>(
    `/platform/event-dead-letters/${eventDeadLetterId}/skip`,
    { method: "POST", body: request },
  );
  return result.data;
}

/** Puts an event that could not be dispatched back to PENDING. */
export async function replayDeadOutboxEvent(eventId: string): Promise<{ eventId: string }> {
  const result = await apiFetch<{ eventId: string }>(
    `/platform/dead-outbox-events/${eventId}/replay`,
    { method: "POST" },
  );
  return result.data;
}

export type OperatorStatusAction = "disable" | "enable";

export async function grantOperator(
  request: z.input<typeof platformOperatorCreateRequestSchema>,
): Promise<PlatformOperatorSummary> {
  const result = await apiFetch<PlatformOperatorSummary>("/platform/operators", {
    method: "POST",
    body: request,
  });
  return result.data;
}

export async function changeOperatorRoles(
  platformOperatorId: string,
  request: PlatformOperatorUpdateBody,
): Promise<PlatformOperatorSummary> {
  const result = await apiFetch<PlatformOperatorSummary>(
    `/platform/operators/${platformOperatorId}`,
    { method: "PATCH", body: request },
  );
  return result.data;
}

export async function changeOperatorStatus(
  platformOperatorId: string,
  action: OperatorStatusAction,
  request: PlatformOperatorStatusBody,
): Promise<PlatformOperatorSummary> {
  const result = await apiFetch<PlatformOperatorSummary>(
    `/platform/operators/${platformOperatorId}/${action}`,
    { method: "POST", body: request },
  );
  return result.data;
}

export async function archivePackage(
  packageId: string,
  version: number,
): Promise<PlatformPackageResponse> {
  const result = await apiFetch<PlatformPackageResponse>(
    `/platform/packages/${packageId}/archive`,
    {
      method: "POST",
      body: { version },
    },
  );
  return result.data;
}

export async function createIndustryTemplate(
  request: IndustryTemplateCreatePayload,
): Promise<PlatformIndustryTemplateDetail> {
  const result = await apiFetch<PlatformIndustryTemplateDetail>("/platform/industry-templates", {
    method: "POST",
    body: request,
  });
  return result.data;
}

export async function updateIndustryTemplate(
  industryTemplateId: string,
  request: IndustryTemplateUpdateBody,
): Promise<PlatformIndustryTemplateDetail> {
  const result = await apiFetch<PlatformIndustryTemplateDetail>(
    `/platform/industry-templates/${industryTemplateId}`,
    { method: "PATCH", body: request },
  );
  return result.data;
}

export async function setIndustryTemplateStatus(
  industryTemplateId: string,
  action: "publish" | "retire",
  request: IndustryTemplateStatusBody,
): Promise<PlatformIndustryTemplateDetail> {
  const result = await apiFetch<PlatformIndustryTemplateDetail>(
    `/platform/industry-templates/${industryTemplateId}/${action}`,
    { method: "POST", body: request },
  );
  return result.data;
}

export async function changeIndustryTemplate(
  organizationId: string,
  request: ChangeIndustryTemplateBody,
): Promise<void> {
  await apiFetch<unknown>(`/platform/organizations/${organizationId}/change-industry-template`, {
    method: "POST",
    body: request,
  });
}

export type { PlatformIndustryTemplateSummary, PlatformSettingDefinition };
