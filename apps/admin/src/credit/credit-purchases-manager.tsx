"use client";

import type { CreditPurchaseResponse } from "@banijjik/contracts/credit";
import { buttonVariants, type DisplayLocale } from "@banijjik/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { fillLabel } from "../catalog/catalog-labels";
import { CreditPurchaseCard } from "./credit-purchase-card";
import { CreditPurchaseDetailSheetLazy } from "./credit-purchase-detail-sheet-lazy";
import type { CreditPurchaseLabels } from "./credit-purchase-labels";
import {
  creditPurchasesHasNext,
  creditPurchasesHref,
  type CreditPurchasesQuery,
} from "./credit-purchase-query";
import { CreditPurchasesFilterForm } from "./credit-purchases-filter-form";

export interface CreditPurchasesManagerProps {
  organizationId: string;
  purchases: CreditPurchaseResponse[];
  total: number;
  query: CreditPurchasesQuery;
  basePath: string;
  canVerify: boolean;
  isOwner: boolean;
  locations: readonly { locationId: string; name: string }[];
  locale: DisplayLocale;
  labels: CreditPurchaseLabels;
}

function Pager(props: {
  basePath: string;
  query: CreditPurchasesQuery;
  total: number;
  labels: CreditPurchaseLabels["page"];
}): ReactElement | null {
  const { basePath, query, total, labels } = props;
  const hasNext = creditPurchasesHasNext(query, total);
  if (query.page === 1 && !hasNext) return null;

  const prevHref = creditPurchasesHref(basePath, { ...query, page: Math.max(1, query.page - 1) });
  const nextHref = creditPurchasesHref(basePath, { ...query, page: query.page + 1 });

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      {query.page > 1 ? (
        <Link href={prevHref} className={buttonVariants({ variant: "secondary" })}>
          {labels.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-secondary">
        {fillLabel(labels.current, { page: String(query.page) })}
      </span>
      {hasNext ? (
        <Link href={nextHref} className={buttonVariants({ variant: "secondary" })}>
          {labels.next}
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

export function CreditPurchasesManager(props: CreditPurchasesManagerProps): ReactElement {
  const {
    organizationId,
    purchases,
    total,
    query,
    basePath,
    canVerify,
    isOwner,
    locations,
    locale,
    labels,
  } = props;
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selectedPurchase = purchases.find((p) => p.creditPurchaseId === selectedId);

  function handleUpdated(): void {
    setSelectedId(undefined);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <CreditPurchasesFilterForm query={query} labels={labels} />

      {purchases.length === 0 ? (
        <div className="rounded-lg border border-default p-8 text-center">
          <p className="text-body text-secondary">{labels.empty}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {purchases.map((purchase) => (
            <CreditPurchaseCard
              key={purchase.creditPurchaseId}
              purchase={purchase}
              locale={locale}
              labels={labels}
              onSelect={(p) => setSelectedId(p.creditPurchaseId)}
            />
          ))}
        </div>
      )}

      <Pager basePath={basePath} query={query} total={total} labels={labels.page} />

      {selectedPurchase ? (
        <CreditPurchaseDetailSheetLazy
          purchase={selectedPurchase}
          organizationId={organizationId}
          canVerify={canVerify}
          isOwner={isOwner}
          locations={locations}
          locale={locale}
          labels={labels}
          onClose={() => setSelectedId(undefined)}
          onUpdated={handleUpdated}
        />
      ) : null}
    </div>
  );
}
