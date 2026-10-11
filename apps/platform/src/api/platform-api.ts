import type {
  LoginRequest,
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
} from "@banijjik/contracts";
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
