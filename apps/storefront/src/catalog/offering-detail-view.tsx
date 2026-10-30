"use client";

import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import { Button } from "@banijjik/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { cartStore } from "../checkout/cart-store";
import { translatorFor } from "../i18n/client-translator";
import { localizedText } from "../i18n/localized-text";
import { OfferingMediaBox } from "./offering-media-box";
import { ProductVariantControls } from "./product-variant-controls";

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

interface UnitPriceParams {
  readonly variant: PublicOfferingDetailResponse["variants"][number] | undefined;
  readonly modifierGroups: PublicOfferingDetailResponse["modifierGroups"];
  readonly selectedModifiers: Record<string, string[]>;
  readonly fallbackPrice: PublicOfferingDetailResponse["startingPrice"];
}

function computeUnitPrice(params: UnitPriceParams) {
  const { variant, modifierGroups, selectedModifiers, fallbackPrice } = params;
  if (!variant) return fallbackPrice;
  let total = variant.price.amount;
  for (const group of modifierGroups) {
    const selected = selectedModifiers[group.modifierGroupId] ?? [];
    for (const optId of selected) {
      const option = group.options.find((o) => o.modifierOptionId === optId);
      if (option) total += option.priceDelta.amount;
    }
  }
  return { amount: total, currency: variant.price.currency };
}

interface AddToCartParams {
  readonly offering: PublicOfferingDetailResponse;
  readonly variant: PublicOfferingDetailResponse["variants"][number];
  readonly locationId: string;
  readonly quantity: number;
  readonly selectedModifiers: Record<string, string[]>;
  readonly unitPrice: PublicOfferingDetailResponse["startingPrice"];
  readonly forceSwitch: boolean;
}

function addSelectionToCart(params: AddToCartParams): {
  readonly ok: boolean;
  readonly reason?: "LOCATION_MISMATCH";
} {
  const { offering, variant, locationId, quantity, selectedModifiers, unitPrice, forceSwitch } =
    params;
  const allOptionIds = Object.values(selectedModifiers).flat();
  const payload = {
    locationId,
    selection: {
      kind: "PRODUCT" as const,
      offeringId: offering.offeringId,
      variantId: variant.variantId,
      quantity,
      modifierOptionIds: allOptionIds,
    },
    display: {
      offeringName: offering.name,
      variantName: variant.name,
      unitPrice,
      mediaUrl: offering.mediaUrl,
      kind: offering.kind,
    },
  };
  if (forceSwitch) {
    cartStore.switchLocationAndAdd(payload);
    return { ok: true };
  }
  return cartStore.addItem(payload);
}

function useOfferingSelection(offering: PublicOfferingDetailResponse, defaultLoc?: string) {
  const searchParams = useSearchParams();
  const locId =
    defaultLoc ||
    searchParams.get("location") ||
    offering.activeLocationIds[0] ||
    offering.publishedLocationIds[0] ||
    "default";

  const [selectedVariantId, setSelectedVariantId] = useState(offering.variants[0]?.variantId ?? "");
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [showConflict, setShowConflict] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);

  const selectedVariant = useMemo(
    () => offering.variants.find((v) => v.variantId === selectedVariantId) ?? offering.variants[0],
    [offering.variants, selectedVariantId],
  );

  const calculatedUnitPrice = useMemo(
    () =>
      computeUnitPrice({
        variant: selectedVariant,
        modifierGroups: offering.modifierGroups,
        selectedModifiers,
        fallbackPrice: offering.startingPrice,
      }),
    [selectedVariant, offering.modifierGroups, selectedModifiers, offering.startingPrice],
  );

  function addToCart(forceSwitch = false) {
    if (!selectedVariant) return;
    const res = addSelectionToCart({
      offering,
      variant: selectedVariant,
      locationId: locId,
      quantity,
      selectedModifiers,
      unitPrice: calculatedUnitPrice,
      forceSwitch,
    });
    if (!res.ok && res.reason === "LOCATION_MISMATCH") {
      setShowConflict(true);
      return;
    }
    setShowConflict(false);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 5000);
  }

  return {
    selectedVariantId,
    setSelectedVariantId,
    selectedModifiers,
    setSelectedModifiers,
    quantity,
    setQuantity,
    showConflict,
    setShowConflict,
    addedNotice,
    calculatedUnitPrice,
    addToCart,
  };
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
          onConfirm={() => sel.addToCart(true)}
          onCancel={() => sel.setShowConflict(false)}
        />
      ) : null}

      {sel.addedNotice ? <AddedToCartAlert t={t} /> : null}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <OfferingMediaBox
          mediaUrl={props.offering.mediaUrl}
          title={localizedText(props.offering.name, props.locale)}
          kind={props.offering.kind}
        />

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="w-fit rounded bg-subtle px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-secondary">
              {props.offering.kind}
            </span>
            <h1 className="text-display font-semibold text-primary">
              {localizedText(props.offering.name, props.locale)}
            </h1>
            <p className="text-title font-semibold text-brand">
              {formatPrice(sel.calculatedUnitPrice.amount, sel.calculatedUnitPrice.currency)}
            </p>
          </div>

          {props.offering.description ? (
            <p className="text-body text-secondary">
              {localizedText(props.offering.description, props.locale)}
            </p>
          ) : null}

          {props.actionSlot ?? (
            <ProductVariantControls
              offering={props.offering}
              locale={props.locale}
              t={t}
              selectedVariantId={sel.selectedVariantId}
              selectedModifiers={sel.selectedModifiers}
              quantity={sel.quantity}
              onVariantChange={sel.setSelectedVariantId}
              onModifiersChange={sel.setSelectedModifiers}
              onQuantityChange={sel.setQuantity}
              onAddToCart={() => sel.addToCart(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
