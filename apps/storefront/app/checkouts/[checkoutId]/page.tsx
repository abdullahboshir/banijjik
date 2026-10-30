import type { Metadata } from "next";
import type { ReactElement } from "react";
import { CheckoutReceiptView } from "../../../src/account/checkout-receipt-view";
import { storefrontTranslator } from "../../../src/i18n/translator";
import { requireOrganizationId } from "../../../src/site/current-site";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface CheckoutPageProps {
  readonly params: Promise<{ readonly checkoutId: string }>;
}

/**
 * Private checkout tracking & live request status page.
 * Never indexed by search engines.
 */
export default async function CheckoutDetailPage({
  params,
}: CheckoutPageProps): Promise<ReactElement> {
  const { checkoutId } = await params;
  const organizationId = await requireOrganizationId();
  const { locale } = await storefrontTranslator();

  return (
    <CheckoutReceiptView organizationId={organizationId} checkoutId={checkoutId} locale={locale} />
  );
}
