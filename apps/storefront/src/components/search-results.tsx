import type { StorefrontDirectoryFormResponse } from "@banijjik/contracts/directory";
import type { Locale, Translator } from "@banijjik/i18n";
import { EmptyState, formatNumber } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { searchPath, type ListingSearchResult, type SearchParams } from "../search/search-query";
import { ListingCard } from "./listing-card";

export interface SearchResultsProps {
  readonly results: ListingSearchResult;
  readonly fields: StorefrontDirectoryFormResponse["fields"];
  readonly params: SearchParams;
  readonly locale: Locale;
  readonly translator: Translator;
}

/** The result count, the rows, and the pager. The page number comes from the URL, so each page is linkable. */
export function SearchResults({
  results,
  fields,
  params,
  locale,
  translator,
}: SearchResultsProps): ReactElement {
  const pages = Math.max(1, Math.ceil(results.total / results.limit));
  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <p className="text-body text-secondary">
        {translator.t("storefront.search.total", {
          count: formatNumber(results.total, { locale }),
        })}
      </p>
      {results.items.length === 0 ? (
        <EmptyState message={translator.t("storefront.search.empty")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {results.items.map((listing) => (
            <ListingCard
              key={listing.listingNumber}
              listing={listing}
              fields={fields}
              locale={locale}
              translator={translator}
            />
          ))}
        </ul>
      )}
      <Pager
        page={results.page}
        pages={pages}
        params={params}
        locale={locale}
        translator={translator}
      />
    </section>
  );
}

interface PagerProps {
  readonly page: number;
  readonly pages: number;
  readonly params: SearchParams;
  readonly locale: Locale;
  readonly translator: Translator;
}

const LINK_CLASS = "inline-flex min-h-11 items-center underline";

function Pager({ page, pages, params, locale, translator }: PagerProps): ReactElement {
  return (
    <nav
      aria-label={translator.t("storefront.search.title")}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      {page > 1 ? (
        <Link href={searchPath(params, page - 1)} className={LINK_CLASS}>
          {translator.t("storefront.search.previous")}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-secondary">
        {translator.t("storefront.search.pageOf", {
          page: formatNumber(page, { locale }),
          pages: formatNumber(pages, { locale }),
        })}
      </span>
      {page < pages ? (
        <Link href={searchPath(params, page + 1)} className={LINK_CLASS}>
          {translator.t("storefront.search.next")}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
