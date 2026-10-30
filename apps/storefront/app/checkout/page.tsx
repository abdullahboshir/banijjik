import type { Metadata } from "next";
import type { ReactElement } from "react";
import { CheckoutView } from "../../src/checkout/checkout-view";
import { storefrontTranslator } from "../../src/i18n/translator";
import { currentSiteResolution, requireOrganizationId } from "../../src/site/current-site";
import { buildPageMetadata } from "../../src/site/site-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const resolution = await currentSiteResolution();
  const { translator } = await storefrontTranslator();
  return buildPageMetadata({
    canonicalHostname: resolution?.canonicalHostname,
    title: translator.t("storefront.checkout.title"),
    path: "/checkout",
  });
}

export default async function CheckoutPage(): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  const { locale } = await storefrontTranslator();

  return <CheckoutView organizationId={organizationId} locale={locale} />;
}
