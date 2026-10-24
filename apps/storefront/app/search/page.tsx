import type { StorefrontDirectoryFormResponse } from "@banijjik/contracts/directory";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { readAsVisitor, readPublic } from "../../src/api/storefront-api";
import { SearchFilters } from "../../src/components/search-filters";
import { SearchResults } from "../../src/components/search-results";
import { storefrontTranslator } from "../../src/i18n/translator";
import {
  filterFieldsOf,
  listingQueryString,
  type ListingSearchResult,
  type SearchParams,
} from "../../src/search/search-query";
import { requireOrganizationId } from "../../src/site/current-site";

interface SearchPageProps {
  readonly searchParams: Promise<SearchParams>;
}

/** Search: the template's filters on the left (stacked on a phone), the matching listings on the right. */
export default async function SearchPage({ searchParams }: SearchPageProps): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  const params = await searchParams;
  const { locale, translator } = await storefrontTranslator();
  const form = await readPublic<StorefrontDirectoryFormResponse>(
    `/orgs/${organizationId}/directory/form`,
  );
  if (form === undefined) notFound();
  const results = await readAsVisitor<ListingSearchResult>(
    `/orgs/${organizationId}/listings?${listingQueryString(params)}`,
  );
  if (results === undefined) notFound();
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[18rem_1fr]">
      <SearchFilters
        fields={filterFieldsOf(form.fields)}
        params={params}
        locale={locale}
        translator={translator}
      />
      <div className="flex flex-col gap-4">
        <h1 className="text-display font-semibold text-primary">
          {translator.t("storefront.search.title")}
        </h1>
        <SearchResults
          results={results}
          fields={form.fields}
          params={params}
          locale={locale}
          translator={translator}
        />
      </div>
    </div>
  );
}
