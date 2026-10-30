"use client";

import type { PublicOfferingSummaryResponse } from "@banijjik/contracts/catalog";
import type { Locale } from "@banijjik/i18n";
import { PublicImage } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { translatorFor } from "../i18n/client-translator";
import { localizedText } from "../i18n/localized-text";

function formatPrice(amount: number, currency: string): string {
  return `${currency} ${(amount / 100).toFixed(2)}`;
}

function CardMedia({
  mediaUrl,
  name,
  kind,
}: {
  readonly mediaUrl: string | null;
  readonly name: string;
  readonly kind: string;
}): ReactElement {
  return (
    <div className="aspect-video w-full overflow-hidden bg-subtle">
      {mediaUrl ? (
        <PublicImage
          src={mediaUrl}
          alt={name}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-small text-secondary">
          {kind}
        </div>
      )}
    </div>
  );
}

function CardFooter({
  priceText,
  detailText,
}: {
  readonly priceText: string;
  readonly detailText: string;
}): ReactElement {
  return (
    <div className="flex items-center justify-between border-t border-default p-4">
      <span className="text-body font-semibold text-primary">{priceText}</span>
      <span className="min-h-11 inline-flex items-center text-small font-semibold text-brand">
        {detailText} &rarr;
      </span>
    </div>
  );
}

export function OfferingCard({
  offering,
  locale,
  locationId,
}: {
  readonly offering: PublicOfferingSummaryResponse;
  readonly locale: Locale;
  readonly locationId?: string | undefined;
}): ReactElement {
  const t = translatorFor(locale).t;
  const href = locationId
    ? `/offerings/${offering.slug}?location=${encodeURIComponent(locationId)}`
    : `/offerings/${offering.slug}`;
  const name = localizedText(offering.name, locale);
  const priceText = t("storefront.catalog.startingFrom", {
    price: formatPrice(offering.startingPrice.amount, offering.startingPrice.currency),
  });

  return (
    <Link
      href={href}
      className="group flex flex-col justify-between overflow-hidden rounded-lg border border-default bg-surface transition-shadow hover:shadow-md"
    >
      <div>
        <CardMedia mediaUrl={offering.mediaUrl} name={name} kind={offering.kind} />
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded bg-subtle px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-secondary">
              {offering.kind}
            </span>
            {offering.activeLocationIds.length > 0 ? (
              <span className="text-xs text-secondary">
                {t("storefront.catalog.publishedLocations", {
                  count: offering.activeLocationIds.length,
                })}
              </span>
            ) : null}
          </div>
          <h2 className="text-title font-semibold text-primary group-hover:text-brand">{name}</h2>
        </div>
      </div>
      <CardFooter priceText={priceText} detailText={t("storefront.catalog.viewDetail")} />
    </Link>
  );
}
