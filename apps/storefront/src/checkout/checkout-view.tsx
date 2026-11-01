"use client";

import type { Locale, Translator } from "@banijjik/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactElement } from "react";
import { translatorFor } from "../i18n/client-translator";
import { cartStore, type CartState } from "./cart-store";
import { requestQuote, submitCheckout } from "./checkout-api";
import { CheckoutAlerts } from "./checkout-alerts";
import { CheckoutContactForm } from "./checkout-contact-form";
import { CheckoutOrderSummary } from "./checkout-order-summary";
import { quoteErrorKeyOf, SUBMIT_OUTCOME, submitOutcomeOf } from "./checkout-outcome";

export interface CheckoutViewProps {
  readonly organizationId: string;
  readonly locale: Locale;
}

function CheckoutEmptyState({ t }: { readonly t: Translator["t"] }): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-default p-12 text-center">
      <h1 className="text-display font-semibold text-primary">{t("storefront.checkout.title")}</h1>
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

interface SubmitParams {
  readonly organizationId: string;
  readonly quoteId: string;
  readonly name: string;
  readonly phone: string;
  readonly router: ReturnType<typeof useRouter>;
  readonly t: Translator["t"];
  readonly onPriceChanged: () => void;
  readonly onQuoteExpired: () => void;
  readonly onError: (msg: string) => void;
}

// Submit runs under the guest session the quote created: a new session would change the quote's
// principal and the server would refuse the quote.
async function executeCheckoutSubmit(params: SubmitParams): Promise<void> {
  const key = cartStore.getOrGenerateIdempotencyKey();
  const res = await submitCheckout(params.organizationId, key, {
    quoteId: params.quoteId,
    contact: { name: params.name.trim(), phone: params.phone.trim() },
  });

  const outcome = submitOutcomeOf(res);
  if (outcome === SUBMIT_OUTCOME.PLACED && res.data) {
    cartStore.clear();
    params.router.push(`/checkouts/${encodeURIComponent(res.data.checkoutId)}`);
    return;
  }
  if (outcome === SUBMIT_OUTCOME.PRICE_CHANGED) {
    params.onPriceChanged();
    return;
  }
  // A lost session leaves the quote unusable just like an expired one; refreshing the quote starts a new session.
  if (outcome === SUBMIT_OUTCOME.QUOTE_EXPIRED || outcome === SUBMIT_OUTCOME.SESSION_LOST) {
    params.onQuoteExpired();
    return;
  }
  if (outcome === SUBMIT_OUTCOME.CAPACITY_UNAVAILABLE) {
    params.onError(params.t("storefront.checkout.capacityUnavailable"));
    return;
  }
  params.onError(params.t("storefront.checkout.errorGeneral"));
}

function useQuoteExpiryCountdown(expiresAtIso: string | undefined) {
  const [isExpired, setIsExpired] = useState(false);
  useEffect(() => {
    if (!expiresAtIso) return;
    const expiresAt = new Date(expiresAtIso).getTime();
    const interval = setInterval(() => {
      if (Date.now() >= expiresAt) setIsExpired(true);
    }, 2000);
    return () => clearInterval(interval);
  }, [expiresAtIso]);
  return [isExpired, setIsExpired] as const;
}

async function fetchRefreshedQuote(
  organizationId: string,
  cart: CartState,
  t: Translator["t"],
): Promise<string | null> {
  if (!cart.locationId) return null;
  const res = await requestQuote(organizationId, {
    locationId: cart.locationId,
    selections: cartStore.getCheckoutSelections(),
    fulfillment: cart.fulfillment,
  });
  if (res.ok && res.data) {
    cartStore.setQuote(res.data);
    cartStore.resetIdempotencyKey();
    return null;
  }
  return t(quoteErrorKeyOf(res));
}

function useCheckoutSubmission(organizationId: string, cart: CartState, t: Translator["t"]) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceChanged, setPriceChanged] = useState(false);
  const [quoteExpired, setQuoteExpired] = useQuoteExpiryCountdown(cart.quote?.expiresAt);

  async function refreshQuote() {
    setIsSubmitting(true);
    setPriceChanged(false);
    setQuoteExpired(false);
    setError(null);
    const err = await fetchRefreshedQuote(organizationId, cart, t);
    setIsSubmitting(false);
    if (err) setError(err);
  }

  async function submit() {
    if (!name.trim() || !phone.trim()) {
      setError(t("storefront.error.fieldRequired"));
      return;
    }
    if (!cart.quote) {
      await refreshQuote();
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setPriceChanged(false);

    await executeCheckoutSubmit({
      organizationId,
      quoteId: cart.quote.quoteId,
      name,
      phone,
      router,
      t,
      onPriceChanged: () => setPriceChanged(true),
      onQuoteExpired: () => setQuoteExpired(true),
      onError: (msg) => setError(msg),
    });
    setIsSubmitting(false);
  }

  return {
    name,
    setName,
    phone,
    setPhone,
    isSubmitting,
    error,
    priceChanged,
    quoteExpired,
    refreshQuote,
    submit,
  };
}

export function CheckoutView(props: CheckoutViewProps): ReactElement {
  const t = translatorFor(props.locale).t;
  const cart = useSyncExternalStore(
    (onStoreChange) => cartStore.subscribe(onStoreChange),
    () => cartStore.getState(),
    () => cartStore.getState(),
  );
  const ch = useCheckoutSubmission(props.organizationId, cart, t);

  if (cart.items.length === 0) {
    return <CheckoutEmptyState t={t} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-primary">
          {t("storefront.checkout.title")}
        </h1>
        <Link href="/cart" className="text-small text-brand hover:underline">
          &larr; {t("storefront.checkout.navCart")}
        </Link>
      </div>

      <CheckoutAlerts
        quoteExpiredAlert={ch.quoteExpired}
        priceChangedAlert={ch.priceChanged}
        isSubmitting={ch.isSubmitting}
        t={t}
        onRefresh={() => {
          void ch.refreshQuote();
        }}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <CheckoutContactForm
          contactName={ch.name}
          contactPhone={ch.phone}
          isSubmitting={ch.isSubmitting}
          errorMessage={ch.error}
          disabled={ch.quoteExpired || ch.priceChanged}
          t={t}
          onNameChange={ch.setName}
          onPhoneChange={ch.setPhone}
          onSubmit={() => {
            void ch.submit();
          }}
        />

        <CheckoutOrderSummary cart={cart} locale={props.locale} t={t} />
      </div>
    </div>
  );
}
