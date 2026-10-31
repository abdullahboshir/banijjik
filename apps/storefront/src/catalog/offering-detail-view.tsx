"use client";

import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import { Button } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { translatorFor } from "../i18n/client-translator";
import { localizedText } from "../i18n/localized-text";
import { buildKindControlCallbacks } from "./kind-control-callbacks";
import { OfferingKindControls } from "./offering-kind-controls";
import { OfferingMediaBox } from "./offering-media-box";
import { useOfferingSelection, type UseOfferingSelectionResult } from "./use-offering-selection";

export interface OfferingDetailViewProps {
  readonly organizationId: string;
  readonly locale: Locale;
  readonly offering: PublicOfferingDetailResponse;
  readonly defaultLocationId?: string | undefined;
  readonly actionSlot?: ReactNode | undefined;
}

function formatPrice(amount: number, currency: string): string {
  return `${currency} ${(amount / 100).toFixed(2)}`;
}

function LocationConflictAlert({
  t,
  onConfirm,
  onCancel,
}: {
  readonly t: Translator["t"];
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): ReactElement {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900"
    >
      <p className="font-semibold">{t("storefront.catalog.locationMismatchWarning")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" className="min-h-11" onClick={onConfirm}>
          {t("storefront.catalog.switchLocationConfirm")}
        </Button>
        <Button variant="secondary" className="min-h-11" onClick={onCancel}>
          {t("storefront.catalog.cancel")}
        </Button>
      </div>
    </div>
  );
}

function AddedToCartAlert({ t }: { readonly t: Translator["t"] }): ReactElement {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-900"
    >
      <span>{t("storefront.catalog.addedToCart")}</span>
      <Link
        href="/cart"
        className="min-h-11 inline-flex items-center rounded bg-green-700 px-3 py-1 font-semibold text-white hover:bg-green-800"
      >
        {t("storefront.catalog.viewCart")} &rarr;
      </Link>
    </div>
  );
}

function OfferingDetailContent({
  props,
  sel,
  t,
}: {
  readonly props: OfferingDetailViewProps;
  readonly sel: UseOfferingSelectionResult;
  readonly t: Translator["t"];
}): ReactElement {
  const { offering, locale, actionSlot, organizationId } = props;
  const cb = buildKindControlCallbacks(offering, sel);

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <OfferingMediaBox
        mediaUrl={offering.mediaUrl}
        title={localizedText(offering.name, locale)}
        kind={offering.kind}
      />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="w-fit rounded bg-subtle px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-secondary">
            {offering.kind}
          </span>
          <h1 className="text-display font-semibold text-primary">
            {localizedText(offering.name, locale)}
          </h1>
          <p className="text-title font-semibold text-brand">
            {formatPrice(sel.calculatedUnitPrice.amount, sel.calculatedUnitPrice.currency)}
          </p>
        </div>

        {offering.description ? (
          <p className="text-body text-secondary">{localizedText(offering.description, locale)}</p>
        ) : null}

        {actionSlot ?? (
          <OfferingKindControls
            organizationId={organizationId}
            offering={offering}
            locale={locale}
            t={t}
            selectedVariantId={sel.selectedVariantId}
            selectedModifiers={sel.selectedModifiers}
            quantity={sel.quantity}
            onVariantChange={sel.setSelectedVariantId}
            onModifiersChange={sel.setSelectedModifiers}
            onQuantityChange={sel.setQuantity}
            onAddToCartProduct={sel.addProductToCart}
            onBookService={cb.onBookService}
            onBookRental={cb.onBookRental}
            onBookEvent={cb.onBookEvent}
            onEnrollPlan={cb.onEnrollPlan}
          />
        )}
      </div>
    </div>
  );
}

export function OfferingDetailView(props: OfferingDetailViewProps): ReactElement {
  const t = translatorFor(props.locale).t;
  const sel = useOfferingSelection(props.offering, props.defaultLocationId);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-small text-secondary">
        <Link href="/offerings" className="hover:text-primary">
          &larr; {t("storefront.catalog.title")}
        </Link>
      </nav>

      {sel.showConflict ? (
        <LocationConflictAlert
          t={t}
          onConfirm={() => sel.pendingAddFn?.(true)}
          onCancel={() => sel.setShowConflict(false)}
        />
      ) : null}

      {sel.addedNotice ? <AddedToCartAlert t={t} /> : null}

      <OfferingDetailContent props={props} sel={sel} t={t} />
    </div>
  );
}
