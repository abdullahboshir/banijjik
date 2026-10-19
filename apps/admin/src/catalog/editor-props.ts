import "server-only";
import { PERMISSION_KEY, type OfferingKind, type PermissionKey } from "@banijjik/contracts";
import {
  CATALOG_DEFAULT_UNIT_SETTING_KEY,
  isUnitKey,
  UNIT_KEY,
  type OfferingResponse,
  type UnitKey,
} from "@banijjik/contracts/catalog";
import type { Translator } from "@banijjik/i18n";
import { currencySymbolOf } from "@banijjik/ui";
import { customFieldPartsOf } from "../custom-fields/custom-field-parts";
import { holdsPermission, holdsPermissionEverywhere } from "../shell/permissions";
import type { OrgAccess } from "../shell/org-access";
import { editorLabelsOf } from "./catalog-labels";
import type { CatalogLookups } from "./catalog-lookups";
import { kindWord, unitLabels } from "./catalog-words";
import type { OfferingEditorProps } from "./offering-editor";
import { formFromOffering, newOfferingForm } from "./offering-form";

/** The unit a new offering starts with: the business setting, else the piece. */
function defaultUnitOf(access: OrgAccess): UnitKey {
  const configured = access.config.settings[CATALOG_DEFAULT_UNIT_SETTING_KEY];
  return typeof configured === "string" && isUnitKey(configured) ? configured : UNIT_KEY.PIECE;
}

/** What the person may do on an existing offering; the API checks the same permissions. */
function editorPermissionsOf(
  access: OrgAccess,
): Pick<OfferingEditorProps, "canWrite" | "canPublish" | "canArchive"> {
  const { permissions } = access.config;
  const can = (key: PermissionKey): boolean => access.canWrite && holdsPermission(permissions, key);
  return {
    canWrite: can(PERMISSION_KEY.CATALOG_OFFERING_UPDATE),
    canPublish: can(PERMISSION_KEY.CATALOG_OFFERING_PUBLISH),
    canArchive: can(PERMISSION_KEY.CATALOG_OFFERING_ARCHIVE),
  };
}

/** Everything the editor needs, read on the server so the browser bundle carries no screen catalog. */
export function buildEditorProps(input: {
  access: OrgAccess;
  translator: Translator;
  lookups: CatalogLookups;
  kind: OfferingKind;
  offering: OfferingResponse | undefined;
}): OfferingEditorProps {
  const { access, translator, lookups, kind, offering } = input;
  const { permissions, terms, kinds, fields } = access.config;
  const word = kindWord({ terms, kinds, translator }, kind);
  const offeringFields = fields["offering"] ?? [];
  const parts = customFieldPartsOf({
    fields: offeringFields,
    values: offering?.customFields ? { ...offering.customFields } : {},
    canSeeSensitive: holdsPermissionEverywhere(permissions, PERMISSION_KEY.CATALOG_OFFERING_UPDATE),
    translator,
    timeZone: access.timeZone,
    currencyCode: lookups.currency,
  });
  return {
    organizationId: access.organization.organizationId,
    orgSlug: access.organization.slug,
    initial: offering ? formFromOffering(offering) : newOfferingForm(kind, defaultUnitOf(access)),
    labels: editorLabelsOf(translator.t),
    unitNames: unitLabels(translator.t),
    kindWord: word,
    status: offering?.status,
    currency: lookups.currency,
    currencySymbol: currencySymbolOf(lookups.currency),
    categories: lookups.categories,
    modifierGroups: lookups.modifierGroups,
    taxClasses: lookups.taxClasses,
    locations: lookups.locations.map(({ locationId, name }) => ({ locationId, name })),
    customFields: offeringFields.length > 0 ? parts.form : undefined,
    ...editorPermissionsOf(access),
  };
}
