import type {
  CustomFieldArchiveRequest,
  CustomFieldDefinitionCreateRequest,
  CustomFieldDefinitionUpdateRequest,
  CustomFieldPreferenceBatchRequest,
  EffectiveCustomField,
  ModuleKey,
  SettingChange,
  SettingsResponse,
  TenantModuleView,
  TermChange,
  TermView,
} from "@banijjik/contracts";
import { apiFetch } from "./api-client";

/** `PATCH /orgs/{organizationId}/settings`: one batch, answered with the resolved values of the touched keys. */
export async function updateSettings(
  organizationId: string,
  items: readonly SettingChange[],
): Promise<SettingsResponse> {
  const result = await apiFetch<SettingsResponse>(`/orgs/${organizationId}/settings`, {
    method: "PATCH",
    body: { items },
  });
  return result.data;
}

/** `PATCH /orgs/{organizationId}/terms`; `text: null` removes the override. */
export async function updateTerms(
  organizationId: string,
  items: readonly TermChange[],
): Promise<{ terms: readonly TermView[] }> {
  const result = await apiFetch<{ terms: readonly TermView[] }>(`/orgs/${organizationId}/terms`, {
    method: "PATCH",
    body: { items },
  });
  return result.data;
}

/** `POST /orgs/{organizationId}/modules/{moduleKey}/disable | enable`, with the reason the API logs. */
export async function switchModule(input: {
  organizationId: string;
  moduleKey: ModuleKey;
  action: "disable" | "enable";
  reason: string;
}): Promise<TenantModuleView> {
  const { organizationId, moduleKey, action, reason } = input;
  const result = await apiFetch<TenantModuleView>(
    `/orgs/${organizationId}/modules/${moduleKey}/${action}`,
    { method: "POST", body: { reason } },
  );
  return result.data;
}

export async function createCustomField(
  organizationId: string,
  body: CustomFieldDefinitionCreateRequest,
): Promise<EffectiveCustomField> {
  const result = await apiFetch<EffectiveCustomField>(`/orgs/${organizationId}/custom-fields`, {
    method: "POST",
    body,
  });
  return result.data;
}

export async function updateCustomField(
  organizationId: string,
  customFieldDefinitionId: string,
  body: CustomFieldDefinitionUpdateRequest,
): Promise<EffectiveCustomField> {
  const result = await apiFetch<EffectiveCustomField>(
    `/orgs/${organizationId}/custom-fields/${customFieldDefinitionId}`,
    { method: "PATCH", body },
  );
  return result.data;
}

export async function archiveCustomField(
  organizationId: string,
  customFieldDefinitionId: string,
  body: CustomFieldArchiveRequest,
): Promise<EffectiveCustomField> {
  const result = await apiFetch<EffectiveCustomField>(
    `/orgs/${organizationId}/custom-fields/${customFieldDefinitionId}/archive`,
    { method: "POST", body },
  );
  return result.data;
}

/** `PATCH /orgs/{organizationId}/custom-fields/preferences`: hide, rename or reorder a template field. */
export async function updateFieldPreferences(
  organizationId: string,
  body: CustomFieldPreferenceBatchRequest,
): Promise<unknown> {
  const result = await apiFetch<unknown>(`/orgs/${organizationId}/custom-fields/preferences`, {
    method: "PATCH",
    body,
  });
  return result.data;
}
