"use client";

import type { Locale, Translator } from "@banijjik/i18n";
import { StatusBadge } from "@banijjik/ui";
import Link from "next/link";
import { useEffect, useState, type ReactElement } from "react";
import { translatorFor } from "../i18n/client-translator";
import { CheckoutSummaryCard, RequestItemCard } from "./checkout-receipt-cards";
import { GuestClaimCard } from "./guest-claim-card";
import {
  claimCheckout,
  getCheckoutDetail,
  type CheckoutDetailResponse,
  type CheckoutRequestLink,
} from "./requests-api";

export { HoldCountdown } from "./hold-countdown";
export type { CheckoutRequestLink };

export interface CheckoutReceiptViewProps {
  readonly organizationId: string;
  readonly checkoutId: string;
  readonly initialData?: CheckoutDetailResponse;
  readonly locale: Locale;
}

interface ClaimActionOptions {
  readonly organizationId: string;
  readonly checkoutId: string;
  readonly onClaimSuccess: () => void;
  readonly t: Translator["t"];
}

function useCheckoutReceiptState(
  organizationId: string,
  checkoutId: string,
  initialData?: CheckoutDetailResponse,
) {
  const [data, setData] = useState<CheckoutDetailResponse | undefined>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(!initialData);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setFetchError(null);
      const res = await getCheckoutDetail(organizationId, checkoutId);
      if (cancelled) return;
      if (res.ok && res.data) {
        setData(res.data);
      } else {
        setFetchError("fetch_failed");
      }
      setIsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, checkoutId, initialData]);

  return { data, setData, isLoading, fetchError };
}

function useCheckoutClaimAction({
  organizationId,
  checkoutId,
  onClaimSuccess,
  t,
}: ClaimActionOptions) {
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [claimFeedback, setClaimFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleClaim() {
    setIsClaiming(true);
    setClaimFeedback(null);
    const res = await claimCheckout(organizationId, checkoutId);
    setIsClaiming(false);

    if (res.ok) {
      setClaimFeedback({
        type: "success",
        message: t("storefront.claim.success"),
      });
      onClaimSuccess();
    } else {
      setClaimFeedback({
        type: "error",
        message: t("storefront.claim.failed"),
      });
    }
  }

  return { isClaiming, claimFeedback, handleClaim };
}

function CheckoutHeader({
  checkoutId,
  status,
  t,
}: {
  readonly checkoutId: string;
  readonly status: string;
  readonly t: Translator["t"];
}): ReactElement {
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-display font-semibold text-primary">
          {t("storefront.requests.checkoutTitle")}
        </h1>
        <p className="font-mono text-caption text-secondary">
          {t("storefront.requests.checkoutId")}: {checkoutId}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-caption text-secondary">{t("storefront.requests.status")}:</span>
        <StatusBadge requestType="ORDER" status={status} label={status} />
      </div>
    </div>
  );
}

function ReceiptBody({
  checkoutId,
  data,
  isClaiming,
  onClaim,
  locale,
}: {
  readonly checkoutId: string;
  readonly data: CheckoutDetailResponse;
  readonly isClaiming: boolean;
  readonly onClaim: () => void;
  readonly locale: Locale;
}): ReactElement {
  const t = translatorFor(locale).t;

  return (
    <>
      <GuestClaimCard
        checkoutId={checkoutId}
        data={data}
        isClaiming={isClaiming}
        onClaim={onClaim}
        locale={locale}
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-body font-semibold text-primary">
          {t("storefront.requests.items")} ({data.requests.length})
        </h2>
        <div className="flex flex-col gap-3">
          {data.requests.map((link) => (
            <RequestItemCard key={link.requestId} item={link} locale={locale} />
          ))}
        </div>
      </section>
      <CheckoutSummaryCard data={data} locale={locale} />
    </>
  );
}

function renderReceiptFallback(isLoading: boolean, t: Translator["t"]): ReactElement {
  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-body text-secondary">{t("storefront.common.loading")}</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
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

/**
 * Private checkout receipt view displaying live request status, hold timers, and guest claim flow.
 */
export function CheckoutReceiptView({
  organizationId,
  checkoutId,
  initialData,
  locale,
}: CheckoutReceiptViewProps): ReactElement {
  const t = translatorFor(locale).t;
  const { data, setData, isLoading, fetchError } = useCheckoutReceiptState(
    organizationId,
    checkoutId,
    initialData,
  );
  const { isClaiming, claimFeedback, handleClaim } = useCheckoutClaimAction({
    organizationId,
    checkoutId,
    onClaimSuccess: () =>
      setData((p) => (p ? { ...p, ownerType: "CUSTOMER", canClaim: false } : undefined)),
    t,
  });

  if (isLoading || fetchError || !data) {
    return renderReceiptFallback(isLoading, t);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <CheckoutHeader checkoutId={data.checkoutId} status={data.status} t={t} />
      {claimFeedback && (
        <div
          role="alert"
          className={`rounded-lg border p-4 text-body ${
            claimFeedback.type === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {claimFeedback.message}
        </div>
      )}
      <ReceiptBody
        checkoutId={checkoutId}
        data={data}
        isClaiming={isClaiming}
        onClaim={() => {
          void handleClaim();
        }}
        locale={locale}
      />
      <div className="pt-2">
        <Link
          href="/account/requests"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border px-4 py-2 text-caption font-medium text-primary hover:bg-muted"
        >
          ← {t("storefront.requests.backToRequests")}
        </Link>
      </div>
    </div>
  );
}
