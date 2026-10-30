"use client";

import type { Locale, Translator } from "@banijjik/i18n";
import { MoneyText, StatusBadge } from "@banijjik/ui";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { translatorFor } from "../i18n/client-translator";
import { HoldCountdown } from "./hold-countdown";
import { getRequestHistory, type RequestHistoryItem } from "./requests-api";

export { RequestDetailView } from "./request-detail-view";
export type { RequestDetailViewProps } from "./request-detail-view";

export interface RequestHistoryViewProps {
  readonly organizationId: string;
  readonly initialItems?: readonly RequestHistoryItem[];
  readonly locale: Locale;
}

type FilterCategory = "ALL" | "ORDER" | "BOOKING" | "ENROLLMENT";

function typeLabelOf(requestType: string, t: Translator["t"]): string {
  if (requestType === "ORDER") return t("storefront.requests.typeOrder");
  if (requestType === "BOOKING") return t("storefront.requests.typeBooking");
  return t("storefront.requests.typeEnrollment");
}

function filterLabelOf(cat: FilterCategory, count: number, t: Translator["t"]): string {
  const countStr = String(count);
  if (cat === "ALL") return t("storefront.requests.filterAll", { count: countStr });
  if (cat === "ORDER") return t("storefront.requests.filterOrders", { count: countStr });
  if (cat === "BOOKING") return t("storefront.requests.filterBookings", { count: countStr });
  return t("storefront.requests.filterEnrollments", { count: countStr });
}

/**
 * Lost-cookie help guidance banner explaining how guest orders can be tracked or claimed.
 */
export function LostCookieHelpNotice({ locale }: { readonly locale: Locale }): ReactElement {
  const t = translatorFor(locale).t;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-caption text-secondary">
      <span className="select-none text-base" aria-hidden="true">
        ℹ️
      </span>
      <p className="leading-relaxed">{t("storefront.requests.lostCookieHelp")}</p>
    </div>
  );
}

function RequestRowCard({
  item,
  locale,
}: {
  readonly item: RequestHistoryItem;
  readonly locale: Locale;
}): ReactElement {
  const t = translatorFor(locale).t;
  const typeLabel = typeLabelOf(item.requestType, t);
  const createdDate = new Date(item.createdAt).toLocaleDateString(
    locale === "bn" ? "bn-BD" : "en-US",
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body font-semibold text-primary">
            {typeLabel} #{item.publicNumber ?? item.requestId}
          </span>
          <StatusBadge requestType={item.requestType} status={item.status} label={item.status} />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-caption text-secondary">
          <span>
            {t("storefront.requests.createdAt")}: {createdDate}
          </span>
          <span>
            {t("storefront.requests.paymentRequired")}:{" "}
            {item.paymentRequired.amount > 0 ? (
              <MoneyText money={item.paymentRequired} locale={locale} />
            ) : (
              <span className="font-medium text-success">
                {t("storefront.requests.noPaymentDue")}
              </span>
            )}
          </span>
          {item.holdExpiresAt && <HoldCountdown expiresAt={item.holdExpiresAt} locale={locale} />}
        </div>
      </div>
      <Link
        href={`/account/requests/${item.requestType.toLowerCase()}/${item.requestId}`}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border px-4 py-2 text-caption font-medium text-primary hover:bg-muted"
      >
        {t("storefront.requests.viewDetails")}
      </Link>
    </div>
  );
}

function EmptyRequestsNotice({ locale }: { readonly locale: Locale }): ReactElement {
  const t = translatorFor(locale).t;
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface p-6 text-center">
      <p className="text-body font-semibold text-primary">{t("storefront.requests.empty")}</p>
      <p className="text-caption text-secondary">{t("storefront.requests.emptyHelp")}</p>
      <div className="pt-2">
        <Link
          href="/"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-primary px-4 py-2 text-caption font-semibold text-surface hover:opacity-90"
        >
          {t("storefront.requests.browseOfferings")}
        </Link>
      </div>
    </div>
  );
}

function useRequestHistoryState(
  organizationId: string,
  initialItems?: readonly RequestHistoryItem[],
) {
  const [items, setItems] = useState<readonly RequestHistoryItem[]>(initialItems ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(!initialItems);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialItems) return;
    let cancelled = false;

    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);
      const res = await getRequestHistory(organizationId);
      if (cancelled) return;
      setIsLoading(false);
      if (res.ok && res.data) setItems(res.data.items);
      else setError("FETCH_ERROR");
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, initialItems]);

  return { items, isLoading, error };
}

function FilterTabsBar({
  activeFilter,
  counts,
  onSelect,
  locale,
}: {
  readonly activeFilter: FilterCategory;
  readonly counts: Record<FilterCategory, number>;
  readonly onSelect: (cat: FilterCategory) => void;
  readonly locale: Locale;
}): ReactElement {
  const t = translatorFor(locale).t;
  const categories: readonly FilterCategory[] = ["ALL", "ORDER", "BOOKING", "ENROLLMENT"];

  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-3">
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onSelect(cat)}
          className={`inline-flex min-h-[44px] items-center justify-center rounded-md px-3.5 py-2 text-caption font-medium transition-colors ${
            activeFilter === cat
              ? "bg-primary font-semibold text-surface"
              : "border border-border bg-surface text-secondary hover:bg-muted hover:text-primary"
          }`}
        >
          {filterLabelOf(cat, counts[cat], t)}
        </button>
      ))}
    </div>
  );
}

function RequestListSection({
  items,
  locale,
}: {
  readonly items: readonly RequestHistoryItem[];
  readonly locale: Locale;
}): ReactElement {
  if (items.length === 0) return <EmptyRequestsNotice locale={locale} />;

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <RequestRowCard key={`${item.requestType}-${item.requestId}`} item={item} locale={locale} />
      ))}
    </div>
  );
}

/**
 * Customer and guest request history view with category filtering and lost-cookie help guidance.
 */
export function RequestHistoryView({
  organizationId,
  initialItems,
  locale,
}: RequestHistoryViewProps): ReactElement {
  const t = translatorFor(locale).t;
  const { items, isLoading, error } = useRequestHistoryState(organizationId, initialItems);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("ALL");

  const counts = useMemo(() => {
    let orders = 0;
    let bookings = 0;
    let enrollments = 0;
    for (const item of items) {
      if (item.requestType === "ORDER") orders++;
      if (item.requestType === "BOOKING") bookings++;
      if (item.requestType === "ENROLLMENT") enrollments++;
    }
    return { ALL: items.length, ORDER: orders, BOOKING: bookings, ENROLLMENT: enrollments };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeFilter === "ALL") return items;
    return items.filter((item) => item.requestType === activeFilter);
  }, [items, activeFilter]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-primary">{t("storefront.requests.title")}</h1>
        <p className="text-body text-secondary">{t("storefront.requests.subtitle")}</p>
      </div>

      <FilterTabsBar
        activeFilter={activeFilter}
        counts={counts}
        onSelect={setActiveFilter}
        locale={locale}
      />

      {isLoading && (
        <div className="flex min-h-[200px] items-center justify-center">
          <p className="text-body text-secondary">{t("storefront.common.loading")}</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-body text-danger">
          {t("storefront.error.generic")}
        </div>
      )}

      {!isLoading && !error && <RequestListSection items={filteredItems} locale={locale} />}

      <LostCookieHelpNotice locale={locale} />
    </div>
  );
}
