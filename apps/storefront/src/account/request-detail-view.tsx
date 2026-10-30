"use client";

import type { Locale, Translator } from "@banijjik/i18n";
import { MoneyText, StatusBadge } from "@banijjik/ui";
import Link from "next/link";
import { useEffect, useState, type ReactElement } from "react";
import { translatorFor } from "../i18n/client-translator";
import { HoldCountdown } from "./hold-countdown";
import { getRequestDetail, type RequestDetailResponse, type RequestType } from "./requests-api";

export interface RequestDetailViewProps {
  readonly organizationId: string;
  readonly requestType: RequestType;
  readonly requestId: string;
  readonly initialData?: RequestDetailResponse;
  readonly locale: Locale;
}

type StatusRequestType = "ORDER" | "BOOKING" | "ENROLLMENT";

function typeLabelOf(requestType: string, t: Translator["t"]): string {
  if (requestType === "ORDER") return t("storefront.requests.typeOrder");
  if (requestType === "BOOKING") return t("storefront.requests.typeBooking");
  return t("storefront.requests.typeEnrollment");
}

function useRequestDetailState(props: RequestDetailViewProps) {
  const [data, setData] = useState<RequestDetailResponse | undefined>(props.initialData);
  const [isLoading, setIsLoading] = useState<boolean>(!props.initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (props.initialData) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      const res = await getRequestDetail(props.organizationId, props.requestType, props.requestId);
      if (cancelled) return;
      if (res.ok && res.data) {
        setData(res.data);
      } else {
        setError("not_found");
      }
      setIsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [props.organizationId, props.requestType, props.requestId, props.initialData]);

  return { data, isLoading, error };
}

function DetailFinancialCard({
  data,
  locale,
}: {
  readonly data: RequestDetailResponse;
  readonly locale: Locale;
}): ReactElement {
  const t = translatorFor(locale).t;
  const dateText = new Date(data.createdAt).toLocaleString(locale === "bn" ? "bn-BD" : "en-US");

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <h2 className="text-body font-semibold text-primary">
        {t("storefront.requests.detailTitle")}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className="text-caption text-secondary">
            {t("storefront.requests.paymentRequired")}:
          </span>
          <div className="text-body font-bold text-primary">
            {data.paymentRequired.amount > 0 ? (
              <MoneyText money={data.paymentRequired} locale={locale} />
            ) : (
              <span className="text-success">{t("storefront.requests.noPaymentDue")}</span>
            )}
          </div>
        </div>
        <div>
          <span className="text-caption text-secondary">{t("storefront.requests.createdAt")}:</span>
          <div className="text-body font-mono text-primary">{dateText}</div>
        </div>
        {data.holdExpiresAt && (
          <div>
            <div className="pt-1">
              <HoldCountdown expiresAt={data.holdExpiresAt} locale={locale} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ItemsListCard({
  items,
  locale,
}: {
  readonly items: readonly unknown[];
  readonly locale: Locale;
}): ReactElement {
  const t = translatorFor(locale).t;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <h2 className="text-body font-semibold text-primary">
        {t("storefront.requests.items")} ({items.length})
      </h2>
      <div className="divide-y divide-border">
        {items.map((item, index) => (
          <div key={index} className="py-2 text-caption text-primary">
            {typeof item === "object" && item !== null && "title" in item
              ? String((item as { title?: unknown }).title)
              : JSON.stringify(item)}
          </div>
        ))}
      </div>
    </section>
  );
}

function renderRequestDetailContent(
  props: RequestDetailViewProps,
  data: RequestDetailResponse,
  t: Translator["t"],
): ReactElement {
  const typeLabel = typeLabelOf(props.requestType, t);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link
          href="/account/requests"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border px-4 py-2 text-caption font-medium text-primary hover:bg-muted"
        >
          ← {t("storefront.requests.backToRequests")}
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-title font-bold text-primary">
            {typeLabel} #{data.publicNumber ?? data.requestId}
          </h1>
          <StatusBadge
            requestType={data.requestType as StatusRequestType}
            status={data.status}
            label={data.status}
          />
        </div>
        <p className="text-caption text-secondary">
          {t("storefront.requests.requestId")}: <span className="font-mono">{data.requestId}</span>
        </p>
      </div>
      <DetailFinancialCard data={data} locale={props.locale} />
      {Array.isArray(data.items) && data.items.length > 0 && (
        <ItemsListCard items={data.items} locale={props.locale} />
      )}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-caption text-secondary">
        <span className="select-none text-base" aria-hidden="true">
          ℹ️
        </span>
        <p className="leading-relaxed">{t("storefront.requests.lostCookieHelp")}</p>
      </div>
    </div>
  );
}

/**
 * Individual request detail view.
 */
export function RequestDetailView(props: RequestDetailViewProps): ReactElement {
  const t = translatorFor(props.locale).t;
  const { data, isLoading, error } = useRequestDetailState(props);

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-body text-secondary">{t("storefront.common.loading")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 p-6">
        <p className="text-body text-danger">{t("storefront.error.generic")}</p>
        <Link
          href="/account/requests"
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border px-4 py-2 text-caption font-medium text-primary hover:bg-muted"
        >
          {t("storefront.requests.backToRequests")}
        </Link>
      </div>
    );
  }

  return renderRequestDetailContent(props, data, t);
}
