import { LOCATION_TYPE, type LocationType } from "@banijjik/contracts";
import type { Locale, Translator } from "@banijjik/i18n";
import { termLabel, type TermTexts } from "@banijjik/web-client";
import type { LocationFormState } from "./location-state";

export interface LocationFormLabels {
  createTitle: string;
  editTitle: string;
  close: string;
  submit: string;
  conflict: string;
  reload: string;
  /** The package-limit explanation; absent when the package has no location limit. */
  limitReached: string | undefined;
  fields: Record<keyof LocationFormState, string>;
  types: Record<LocationType, string>;
  businessTimezone: string;
}

export interface LocationArchiveLabels {
  title: string;
  description: string;
  confirm: string;
  cancel: string;
  close: string;
  conflict: string;
}

/**
 * The word for a location: the business's term `location` in the user's language, or the catalog word.
 * "Add {term}" and "No {term} found" read it, so a renamed term shows on every locations screen (ADR-104).
 */
export function locationTermOf(terms: TermTexts, locale: Locale, t: Translator["t"]): string {
  return termLabel(terms, "location", { locale, fallback: t("locations.term") });
}

export function locationTypeLabels(t: Translator["t"]): Record<LocationType, string> {
  return {
    [LOCATION_TYPE.STORE]: t("locations.type.store"),
    [LOCATION_TYPE.WAREHOUSE]: t("locations.type.warehouse"),
  };
}

/** `limit` is the location limit of the package, from the business config; null means no limit. */
export function locationFormLabelsOf(
  t: Translator["t"],
  limit: number | null,
  term: string,
): LocationFormLabels {
  return {
    createTitle: t("locations.form.create.title", { term }),
    editTitle: t("locations.form.edit.title", { term }),
    close: t("shell.closeMenu"),
    submit: t("common.save"),
    conflict: t("settings.conflict"),
    reload: t("settings.reload"),
    limitReached: limit === null ? undefined : t("locations.limitReached", { limit }),
    fields: {
      name: t("locations.field.name"),
      locationType: t("locations.field.type"),
      locationPhone: t("locations.field.phone"),
      line1: t("address.line1"),
      area: t("address.area"),
      thana: t("address.thana"),
      district: t("address.district"),
      postalCode: t("address.postalCode"),
      timezone: t("locations.field.timezone"),
    },
    types: locationTypeLabels(t),
    businessTimezone: t("locations.timezone.business"),
  };
}

export function locationArchiveLabelsOf(t: Translator["t"], name: string): LocationArchiveLabels {
  return {
    title: t("locations.archive.title", { name }),
    description: t("locations.archive.description"),
    confirm: t("locations.archive"),
    cancel: t("common.cancel"),
    close: t("shell.closeMenu"),
    conflict: t("settings.conflict"),
  };
}
