"use client";

import type { OfferingKind, PublicCategoryResponse } from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";
import type { PublicLocationResponse } from "./storefront-catalog-api";

export interface FilterState {
  readonly q: string;
  readonly kind: string;
  readonly categoryId: string;
  readonly location: string;
}

const ALL_KINDS: readonly OfferingKind[] = ["PRODUCT", "SERVICE", "RENTAL", "EVENT", "PLAN"];

function SearchRow({
  query,
  t,
  onChange,
}: {
  readonly query: string;
  readonly t: Translator["t"];
  readonly onChange: (q: string) => void;
}): ReactElement {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="min-w-0 flex-1">
        <FormField label={t("storefront.search.title")} htmlFor="catalog-search">
          <TextInput
            id="catalog-search"
            name="q"
            value={query}
            placeholder={t("storefront.catalog.searchPlaceholder")}
            onChange={(e) => onChange(e.target.value)}
          />
        </FormField>
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="primary" className="min-h-11 w-full sm:w-auto">
          {t("storefront.search.apply")}
        </Button>
      </div>
    </div>
  );
}

function LocationDropdown({
  location,
  locations,
  t,
  onUpdate,
}: {
  readonly location: string;
  readonly locations: readonly PublicLocationResponse[];
  readonly t: Translator["t"];
  readonly onUpdate: (loc: string) => void;
}): ReactElement | null {
  if (locations.length === 0) return null;
  return (
    <FormField label={t("storefront.catalog.filterLocation")} htmlFor="filter-location">
      <Select id="filter-location" value={location} onChange={(e) => onUpdate(e.target.value)}>
        <option value="">{t("storefront.catalog.allLocations")}</option>
        {locations.map((loc) => (
          <option key={loc.locationId} value={loc.locationId}>
            {loc.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function FilterDropdowns({
  draft,
  categories,
  locations,
  locale,
  t,
  onUpdate,
}: {
  readonly draft: FilterState;
  readonly categories: readonly PublicCategoryResponse[];
  readonly locations: readonly PublicLocationResponse[];
  readonly locale: Locale;
  readonly t: Translator["t"];
  readonly onUpdate: (field: keyof FilterState, val: string) => void;
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <FormField label={t("storefront.catalog.filterCategory")} htmlFor="filter-cat">
        <Select
          id="filter-cat"
          value={draft.categoryId}
          onChange={(e) => onUpdate("categoryId", e.target.value)}
        >
          <option value="">{t("storefront.catalog.allCategories")}</option>
          {categories.map((c) => (
            <option key={c.categoryId} value={c.categoryId}>
              {localizedText(c.name, locale)} ({c.offeringCount})
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label={t("storefront.catalog.filterKind")} htmlFor="filter-kind">
        <Select
          id="filter-kind"
          value={draft.kind}
          onChange={(e) => onUpdate("kind", e.target.value)}
        >
          <option value="">{t("storefront.catalog.allKinds")}</option>
          {ALL_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </Select>
      </FormField>

      <LocationDropdown
        location={draft.location}
        locations={locations}
        t={t}
        onUpdate={(loc) => onUpdate("location", loc)}
      />
    </div>
  );
}

export function CatalogFilterForm({
  filters,
  categories,
  locations,
  locale,
  t,
  onSubmit,
}: {
  readonly filters: FilterState;
  readonly categories: readonly PublicCategoryResponse[];
  readonly locations: readonly PublicLocationResponse[];
  readonly locale: Locale;
  readonly t: Translator["t"];
  readonly onSubmit: (updated: FilterState) => void;
}): ReactElement {
  const [draft, setDraft] = useState(filters);

  function handleUpdate(field: keyof FilterState, val: string) {
    const updated = { ...draft, [field]: val };
    setDraft(updated);
    if (field !== "q") onSubmit(updated);
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-default bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
    >
      <SearchRow query={draft.q} t={t} onChange={(q) => setDraft({ ...draft, q })} />
      <FilterDropdowns
        draft={draft}
        categories={categories}
        locations={locations}
        locale={locale}
        t={t}
        onUpdate={handleUpdate}
      />
    </form>
  );
}
