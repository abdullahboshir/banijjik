import type { Locale, Translator } from "@banijjik/i18n";
import { formatPhoneForDisplay, MoneyText, StatusBadge } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { translatorFor } from "../i18n/client-translator";
import { HoldCountdown } from "./hold-countdown";
import type { CheckoutDetailResponse, CheckoutRequestLink } from "./requests-api";

function typeLabelOf(requestType: string, t: Translator["t"]): string {
  if (requestType === "ORDER") return t("storefront.requests.typeOrder");
  if (requestType === "BOOKING") return t("storefront.requests.typeBooking");
  return t("storefront.requests.typeEnrollment");
}

export function RequestItemCard({
  item,
  locale,
}: {
  readonly item: CheckoutRequestLink;
  readonly locale: Locale;
}): ReactElement {
  const t = translatorFor(locale).t;
  const typeLabel = typeLabelOf(item.requestType, t);

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
            {t("storefront.requests.paymentRequired")}:{" "}
            {item.paymentRequired.amount > 0 ? (
              <MoneyText money={item.paymentRequired} locale={locale} />
            ) : (
              <span className="text-success">{t("storefront.requests.noPaymentDue")}</span>
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

export function CheckoutSummaryCard({
  data,
  locale,
}: {
  readonly data: CheckoutDetailResponse;
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
            {t("storefront.requests.totalAccepted")}:
          </span>
          <div className="text-body font-bold text-primary">
            <MoneyText money={data.acceptedTotals} locale={locale} />
          </div>
        </div>
        <div>
          <span className="text-caption text-secondary">{t("storefront.requests.createdAt")}:</span>
          <div className="text-body font-mono text-primary">{dateText}</div>
        </div>
        <div>
          <span className="text-caption text-secondary">
            {t("storefront.requests.contactName")}:
          </span>
          <div className="text-body text-primary">{data.contactSnapshot.name}</div>
        </div>
        <div>
          <span className="text-caption text-secondary">
            {t("storefront.requests.contactPhone")}:
          </span>
          <div className="text-body text-primary">
            {formatPhoneForDisplay(data.contactSnapshot.phoneE164)}
          </div>
        </div>
      </div>
    </section>
  );
}
