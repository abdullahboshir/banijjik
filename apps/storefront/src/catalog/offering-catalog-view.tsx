"use client";

import type {
  PublicCategoryResponse,
  PublicOfferingListResponse,
  PublicOfferingSummaryResponse,
} from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import { Button } from "@banijjik/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactElement } from "react";
import { translatorFor } from "../i18n/client-translator";
import { CatalogFilterForm, type FilterState } from "./catalog-filter-form";
import { OfferingCard } from "./offering-card";
import type { PublicLocationResponse } from "./storefront-catalog-api";

export interface OfferingCatalogViewProps {
  readonly organizationId: string;
  readonly locale: Locale;
  readonly initialOfferings: PublicOfferingListResponse;
  readonly categories: readonly PublicCategoryResponse[];
  readonly locations: readonly PublicLocationResponse[];
  readonly selectedLocationId?: string | undefined;
  readonly selectedCategoryId?: string | undefined;
  readonly selectedKind?: string | undefined;
  readonly initialSearchQuery?: string | undefined;
}

function buildCatalogUrl(state: FilterState, page: number): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.kind) params.set("kind", state.kind);
  if (state.categoryId) params.set("categoryId", state.categoryId);
  if (state.location) params.set("location", state.location);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/offerings${qs ? `?${qs}` : ""}`;
}

function CatalogGrid({
  items,
  locale,
  locationId,
  emptyText,
}: {
  readonly items: readonly PublicOfferingSummaryResponse[];
  readonly locale: Locale;
  readonly locationId: string;
  readonly emptyText: string;
}): ReactElement {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-default p-8 text-center text-secondary">
        <p>{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {items.map((offering) => (
        <OfferingCard
          key={offering.offeringId}
          offering={offering}
          locale={locale}
          locationId={locationId}
        />
      ))}
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  t,
  onPageChange,
}: {
  readonly page: number;
  readonly totalPages: number;
  readonly t: Translator["t"];
  readonly onPageChange: (target: number) => void;
}): ReactElement | null {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 py-4">
      <Button
        variant="secondary"
        className="min-h-11"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t("storefront.search.previous")}
      </Button>
      <span className="text-small text-secondary">
        {t("storefront.search.pageOf", { page, pages: totalPages })}
      </span>
      <Button
        variant="secondary"
        className="min-h-11"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t("storefront.search.next")}
      </Button>
    </div>
  );
}

export function OfferingCatalogView(props: OfferingCatalogViewProps): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = translatorFor(props.locale).t;

  const [filters, setFilters] = useState<FilterState>(() => ({
    q: props.initialSearchQuery ?? searchParams.get("q") ?? "",
    kind: props.selectedKind ?? searchParams.get("kind") ?? "",
    categoryId: props.selectedCategoryId ?? searchParams.get("categoryId") ?? "",
    location: props.selectedLocationId ?? searchParams.get("location") ?? "",
  }));

  const { page, total, limit } = props.initialOfferings;
  const totalPages = Math.ceil(total / limit) || 1;

  function handleFilterSubmit(updated: FilterState, targetPage = 1) {
    setFilters(updated);
    router.push(buildCatalogUrl(updated, targetPage));
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display font-semibold text-primary">{t("storefront.catalog.title")}</h1>

      <CatalogFilterForm
        filters={filters}
        categories={props.categories}
        locations={props.locations}
        locale={props.locale}
        t={t}
        onSubmit={(updated) => handleFilterSubmit(updated, 1)}
      />

      <CatalogGrid
        items={props.initialOfferings.items}
        locale={props.locale}
        locationId={filters.location}
        emptyText={t("storefront.catalog.noOfferings")}
      />

      <PaginationControls
        page={page}
        totalPages={totalPages}
        t={t}
        onPageChange={(target) => handleFilterSubmit(filters, target)}
      />
    </div>
  );
}
