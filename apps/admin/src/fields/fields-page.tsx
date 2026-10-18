import {
  isCustomFieldEntityType,
  PERMISSION_KEY,
  type CustomFieldEntityType,
  type EffectiveCustomField,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission, holdsPermissionEverywhere } from "../shell/permissions";
import { FieldList } from "./field-list";
import { fieldLabelsOf, fieldListLabelsOf } from "./field-labels";
import { nextSortOrder, toFieldRows, type FieldAbilities } from "./field-rows";
import { NewFieldButton } from "./new-field-button";

const PAGE_SIZE = 100;
const CHIP_CLASS =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small transition-colors";

/** The record types that have fields for this business: the keys of `/me/config.fields`. */
function entityTypesOf(access: OrgAccess): CustomFieldEntityType[] {
  return Object.keys(access.config.fields).filter(isCustomFieldEntityType).sort();
}

function entityLabelOf(entityType: string, t: Translator["t"]): string {
  const labelKey = `fields.entity.${entityType}`;
  return t(labelKey) === labelKey ? entityType : t(labelKey);
}

function EntityTabs({
  basePath,
  entityTypes,
  selected,
  t,
}: {
  basePath: string;
  entityTypes: readonly CustomFieldEntityType[];
  selected: CustomFieldEntityType;
  t: Translator["t"];
}): ReactElement {
  return (
    <nav aria-label={t("fields.entity.label")} className="flex items-center gap-2 overflow-x-auto">
      {entityTypes.map((entityType) => {
        const isActive = entityType === selected;
        return (
          <Link
            key={entityType}
            href={`${basePath}?entity=${entityType}`}
            aria-current={isActive ? "true" : undefined}
            className={`${CHIP_CLASS} ${isActive ? "border-brand bg-brand text-on-brand" : "border-default bg-subtle text-primary"}`}
          >
            {entityLabelOf(entityType, t)}
          </Link>
        );
      })}
    </nav>
  );
}

function abilitiesOf(access: OrgAccess): FieldAbilities {
  const { permissions } = access.config;
  // The API needs each key at every location for any field write, so a one-location manager sees no button.
  const holds = (key: Parameters<typeof holdsPermissionEverywhere>[1]): boolean =>
    access.canWrite && holdsPermissionEverywhere(permissions, key);
  return {
    canCreate: holds(PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_CREATE),
    canUpdate: holds(PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_UPDATE),
    canArchive: holds(PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_ARCHIVE),
  };
}

function chosenEntity(
  value: string | string[] | undefined,
  entityTypes: readonly CustomFieldEntityType[],
): CustomFieldEntityType | undefined {
  return entityTypes.find((entityType) => entityType === value) ?? entityTypes[0];
}

/**
 * `/{orgSlug}/settings/fields`: the custom fields of each record type. A business adds its own fields and
 * can rename, reorder or hide the template's (ADR-102).
 */
export async function FieldsPage({
  orgSlug,
  searchParams,
}: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t, locale } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const entityTypes = entityTypesOf(access);
  const entityType = chosenEntity(searchParams["entity"], entityTypes);
  if (entityType === undefined) return <EmptyState message={t("fields.noEntities")} />;
  const { organizationId } = access.organization;
  const result = await fetchBusinessResource<EffectiveCustomField[]>(
    `/orgs/${organizationId}/custom-fields?entityType=${entityType}&limit=${PAGE_SIZE}`,
  );
  const abilities = abilitiesOf(access);
  const formLabels = fieldLabelsOf(t, { terms: access.config.terms, locale });
  return (
    <PageLayout
      subtitle={t("fields.subtitle")}
      title={t("fields.title")}
      actions={
        abilities.canCreate ? (
          <NewFieldButton
            organizationId={organizationId}
            entityType={entityType}
            label={t("fields.add")}
            sortOrder={nextSortOrder(result.data)}
            labels={formLabels}
          />
        ) : null
      }
      filters={
        <EntityTabs
          basePath={`/${orgSlug}/settings/fields`}
          entityTypes={entityTypes}
          selected={entityType}
          t={t}
        />
      }
    >
      <FieldList
        organizationId={organizationId}
        rows={toFieldRows(result.data, { abilities, locale, t })}
        labels={fieldListLabelsOf(t)}
        formLabels={formLabels}
      />
    </PageLayout>
  );
}
