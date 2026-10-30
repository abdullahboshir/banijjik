import type { Metadata } from "next";
import type { ReactElement } from "react";
import { CartView } from "../../src/checkout/cart-view";
import { storefrontTranslator } from "../../src/i18n/translator";
import { currentSiteResolution, requireOrganizationId } from "../../src/site/current-site";
import { buildPageMetadata } from "../../src/site/site-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const resolution = await currentSiteResolution();
  const { translator } = await storefrontTranslator();
  return buildPageMetadata({
    canonicalHostname: resolution?.canonicalHostname,
    title: translator.t("storefront.cart.title"),
    path: "/cart",
  });
}

export default async function CartPage(): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  const { locale } = await storefrontTranslator();

  return <CartView organizationId={organizationId} locale={locale} />;
}
