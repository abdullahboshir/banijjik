"use client";

import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import type { PublicSelection } from "@banijjik/contracts/website";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { cartStore, type CartItemDisplayInfo } from "../checkout/cart-store";

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

interface GenericAddParams {
  readonly locationId: string;
  readonly selection: PublicSelection;
  readonly display: CartItemDisplayInfo;
  readonly customFields?: Readonly<Record<string, unknown>> | undefined;
  readonly forceSwitch: boolean;
}

function addGenericSelectionToCart(params: GenericAddParams): {
  readonly ok: boolean;
  readonly reason?: "LOCATION_MISMATCH";
} {
  const { locationId, selection, display, customFields, forceSwitch } = params;
  const payload = {
    locationId,
    selection,
    display,
    customFields,
  };
  if (forceSwitch) {
    cartStore.switchLocationAndAdd(payload);
    return { ok: true };
  }
  return cartStore.addItem(payload);
}

function resolveLocationId(
  offering: PublicOfferingDetailResponse,
  defaultLoc?: string,
  queryLoc?: string | null,
): string {
  if (defaultLoc) return defaultLoc;
  if (queryLoc) return queryLoc;
  if (offering.activeLocationIds[0]) return offering.activeLocationIds[0];
  if (offering.publishedLocationIds[0]) return offering.publishedLocationIds[0];
  return "default";
}

export interface UseOfferingSelectionResult {
  readonly selectedVariantId: string;
  readonly setSelectedVariantId: (id: string) => void;
  readonly selectedModifiers: Record<string, string[]>;
  readonly setSelectedModifiers: (mods: Record<string, string[]>) => void;
  readonly quantity: number;
  readonly setQuantity: (fn: (q: number) => number) => void;
  readonly showConflict: boolean;
  readonly setShowConflict: (show: boolean) => void;
  readonly pendingAddFn: ((force: boolean) => void) | null;
  readonly addedNotice: boolean;
  readonly calculatedUnitPrice: PublicOfferingDetailResponse["startingPrice"];
  readonly executeAdd: (
    selection: PublicSelection,
    display: CartItemDisplayInfo,
    customFields?: Readonly<Record<string, unknown>>,
  ) => void;
  readonly addProductToCart: () => void;
}

function useCartExecutor(locId: string) {
  const [showConflict, setShowConflict] = useState(false);
  const [pendingAddFn, setPendingAddFn] = useState<((force: boolean) => void) | null>(null);
  const [addedNotice, setAddedNotice] = useState(false);

  function executeAdd(
    selection: PublicSelection,
    display: CartItemDisplayInfo,
    customFields?: Readonly<Record<string, unknown>>,
  ) {
    const doAdd = (force: boolean) => {
      const res = addGenericSelectionToCart({
        locationId: locId,
        selection,
        display,
        customFields,
        forceSwitch: force,
      });
      if (!res.ok && res.reason === "LOCATION_MISMATCH") {
        setShowConflict(true);
        setPendingAddFn(() => doAdd);
        return;
      }
      setShowConflict(false);
      setPendingAddFn(null);
      setAddedNotice(true);
      setTimeout(() => setAddedNotice(false), 5000);
    };
    doAdd(false);
  }

  return { showConflict, setShowConflict, pendingAddFn, addedNotice, executeAdd };
}

export function useOfferingSelection(
  offering: PublicOfferingDetailResponse,
  defaultLoc?: string,
): UseOfferingSelectionResult {
  const searchParams = useSearchParams();
  const locId = resolveLocationId(offering, defaultLoc, searchParams.get("location"));
  const ex = useCartExecutor(locId);

  const [selectedVariantId, setSelectedVariantId] = useState(offering.variants[0]?.variantId ?? "");
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);

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

  function addProductToCart() {
    if (!selectedVariant) return;
    ex.executeAdd(
      {
        kind: "PRODUCT",
        offeringId: offering.offeringId,
        variantId: selectedVariant.variantId,
        quantity,
        modifierOptionIds: Object.values(selectedModifiers).flat(),
      },
      {
        offeringName: offering.name,
        variantName: selectedVariant.name,
        unitPrice: calculatedUnitPrice,
        mediaUrl: offering.mediaUrl,
        kind: offering.kind,
      },
    );
  }

  return {
    selectedVariantId,
    setSelectedVariantId,
    selectedModifiers,
    setSelectedModifiers,
    quantity,
    setQuantity,
    showConflict: ex.showConflict,
    setShowConflict: ex.setShowConflict,
    pendingAddFn: ex.pendingAddFn,
    addedNotice: ex.addedNotice,
    calculatedUnitPrice,
    executeAdd: ex.executeAdd,
    addProductToCart,
  };
}
