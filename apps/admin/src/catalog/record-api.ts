import type {
  CategoryResponse,
  Money,
  ModifierGroupResponse,
  ModifierSelection,
  SynonymEntry,
  SynonymsResponse,
} from "@banijjik/contracts/catalog";
import { apiFetch } from "../lib/api/api-client";

function base(organizationId: string): string {
  return `/orgs/${organizationId}`;
}

export interface CategoryWrite {
  name?: string;
  parentCategoryId?: string | null;
  sortOrder?: number;
}

export async function createCategory(
  organizationId: string,
  body: { name: string; parentCategoryId?: string; sortOrder?: number },
): Promise<CategoryResponse> {
  const result = await apiFetch<CategoryResponse>(`${base(organizationId)}/categories`, {
    method: "POST",
    body,
  });
  return result.data;
}

export async function updateCategory(
  organizationId: string,
  input: { categoryId: string; version: number; changes: CategoryWrite },
): Promise<CategoryResponse> {
  const result = await apiFetch<CategoryResponse>(
    `${base(organizationId)}/categories/${input.categoryId}`,
    { method: "PATCH", body: { ...input.changes, version: input.version } },
  );
  return result.data;
}

export async function archiveCategory(
  organizationId: string,
  input: { categoryId: string; version: number },
): Promise<CategoryResponse> {
  const result = await apiFetch<CategoryResponse>(
    `${base(organizationId)}/categories/${input.categoryId}/archive`,
    { method: "POST", body: { version: input.version } },
  );
  return result.data;
}

export interface ModifierGroupWrite {
  name: string;
  selection: ModifierSelection;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: { modifierOptionId?: string; name: string; priceDelta: Money }[];
}

export async function createModifierGroup(
  organizationId: string,
  body: ModifierGroupWrite,
): Promise<ModifierGroupResponse> {
  const result = await apiFetch<ModifierGroupResponse>(`${base(organizationId)}/modifier-groups`, {
    method: "POST",
    body,
  });
  return result.data;
}

export async function updateModifierGroup(
  organizationId: string,
  input: { modifierGroupId: string; version: number; body: ModifierGroupWrite },
): Promise<ModifierGroupResponse> {
  const result = await apiFetch<ModifierGroupResponse>(
    `${base(organizationId)}/modifier-groups/${input.modifierGroupId}`,
    { method: "PATCH", body: { ...input.body, version: input.version } },
  );
  return result.data;
}

export async function archiveModifierGroup(
  organizationId: string,
  input: { modifierGroupId: string; version: number },
): Promise<ModifierGroupResponse> {
  const result = await apiFetch<ModifierGroupResponse>(
    `${base(organizationId)}/modifier-groups/${input.modifierGroupId}/archive`,
    { method: "POST", body: { version: input.version } },
  );
  return result.data;
}

export async function saveSynonyms(
  organizationId: string,
  body: { entries: SynonymEntry[]; version: number },
): Promise<SynonymsResponse> {
  const result = await apiFetch<SynonymsResponse>(`${base(organizationId)}/catalog/synonyms`, {
    method: "PUT",
    body,
  });
  return result.data;
}
