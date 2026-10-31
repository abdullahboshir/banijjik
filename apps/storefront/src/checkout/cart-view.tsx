"use client";

import type { CheckoutFulfillment } from "@banijjik/contracts/website";
import type { Locale, Translator } from "@banijjik/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import { translatorFor } from "../i18n/client-translator";
import { CartFulfillmentOptions, type CartDeliveryAddress } from "./cart-fulfillment-options";
import { CartLineRow } from "./cart-line-row";
import { CartQuoteSidebar } from "./cart-quote-sidebar";
import { cartStore, type CartState } from "./cart-store";
import { requestQuote } from "./checkout-api";

export interface CartViewProps {
  readonly organizationId: string;
  readonly locale: Locale;
}

function CartEmptyState({ t }: { readonly t: Translator["t"] }): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-default p-12 text-center">
      <h1 className="text-display font-semibold text-primary">{t("storefront.cart.title")}</h1>
      <p className="text-body text-secondary">{t("storefront.cart.empty")}</p>
      <Link
        href="/offerings"
        className="min-h-11 inline-flex items-center rounded-md bg-brand px-6 font-semibold text-on-brand hover:bg-brand-hover"
      >
        {t("storefront.cart.continueShopping")}
      </Link>
    </div>
  );
}

const EMPTY_ADDRESS: CartDeliveryAddress = {
  recipientName: "",
  phone: "",
  addressLine: "",
  districtCode: "dhaka",
  areaCode: "dhanmondi",
  postalCode: "",
};

function initialAddressOf(address?: CartState["fulfillment"]["address"]): CartDeliveryAddress {
  if (!address) return EMPTY_ADDRESS;
  return {
    ...EMPTY_ADDRESS,
    ...address,
  };
}

function buildFulfillmentPayload(
  method: "PICKUP" | "COURIER" | "OWN_RIDER",
  address: CartDeliveryAddress,
): CheckoutFulfillment {
  if (method === "PICKUP") return { method: "PICKUP" };
  return { method, address };
}

function useCartQuote(organizationId: string, cart: CartState, t: Translator["t"]) {
  const [method, setMethod] = useState<"PICKUP" | "COURIER" | "OWN_RIDER">(cart.fulfillment.method);
  const [address, setAddress] = useState<CartDeliveryAddress>(() =>
    initialAddressOf(cart.fulfillment.address),
  );
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!cart.locationId || cart.items.length === 0) {
      cartStore.setQuote(null);
      return;
    }
    setIsQuoting(true);
    setQuoteError(null);
    const res = await requestQuote(organizationId, {
      locationId: cart.locationId,
      selections: cartStore.getCheckoutSelections(),
      fulfillment: buildFulfillmentPayload(method, address),
    });
    setIsQuoting(false);
    if (!res.ok || !res.data) {
      setQuoteError(t("storefront.cart.quoteError"));
      return;
    }
    cartStore.setQuote(res.data);
  }, [cart.items.length, cart.locationId, method, address, organizationId, t]);

  useEffect(() => {
    void fetchQuote();
  }, [fetchQuote]);

  function handleMethodChange(m: "PICKUP" | "COURIER" | "OWN_RIDER") {
    setMethod(m);
    cartStore.setFulfillment(buildFulfillmentPayload(m, address));
  }

  function handleAddressChange(field: keyof CartDeliveryAddress, val: string) {
    const updated: CartDeliveryAddress = { ...address, [field]: val };
    setAddress(updated);
    if (method !== "PICKUP") cartStore.setFulfillment({ method, address: updated });
  }

  return { method, address, isQuoting, quoteError, handleMethodChange, handleAddressChange };
}

export function CartView(props: CartViewProps): ReactElement {
  const router = useRouter();
  // One translator per locale: `fetchQuote` depends on `t`, and a fresh one each render would re-quote forever.
  const t = useMemo(() => translatorFor(props.locale).t, [props.locale]);

  const cart = useSyncExternalStore(
    (onStoreChange) => cartStore.subscribe(onStoreChange),
    () => cartStore.getState(),
    () => cartStore.getState(),
  );

  const q = useCartQuote(props.organizationId, cart, t);

  if (cart.items.length === 0) {
    return <CartEmptyState t={t} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display font-semibold text-primary">
          {t("storefront.cart.title")} ({cart.items.length})
        </h1>
        {cart.locationId ? (
          <span className="rounded bg-subtle px-3 py-1 text-small text-secondary">
            {t("storefront.cart.location", { location: cart.locationId })}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="flex flex-col divide-y divide-default rounded-lg border border-default bg-surface">
            {cart.items.map((line) => (
              <CartLineRow key={line.selectionId} line={line} locale={props.locale} t={t} />
            ))}
          </div>

          <CartFulfillmentOptions
            fulfillmentMethod={q.method}
            deliveryAddress={q.address}
            t={t}
            onMethodChange={q.handleMethodChange}
            onAddressChange={q.handleAddressChange}
          />
        </div>

        <CartQuoteSidebar
          cart={cart}
          isQuoting={q.isQuoting}
          quoteError={q.quoteError}
          t={t}
          onProceed={() => router.push("/checkout")}
        />
      </div>
    </div>
  );
}
