import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import type { ReactElement, ReactNode } from "react";
import { SessionRenewer } from "../src/components/session-renewer";
import { SiteFooter, SiteHeader } from "../src/components/site-chrome";
import { readPublic, readSignedInCustomer } from "../src/api/storefront-api";
import { storefrontTranslator } from "../src/i18n/translator";
import { organizationIdFrom } from "../src/host/organization-header";
import { currentSiteResolution } from "../src/site/current-site";
import { buildLayoutMetadata } from "../src/site/site-metadata";
import { brandName } from "../src/config/environment";
import { themeStyle } from "../src/site/theme";
import type { StorefrontMeResponse } from "@banijjik/contracts/contact";
import type { StorefrontSiteResponse } from "@banijjik/contracts/website";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
  variable: "--font-inter",
});
const notoSansBengali = localFont({
  src: [
    { path: "./fonts/noto-sans-bengali-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/noto-sans-bengali-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  adjustFontFallback: "Arial",
  variable: "--font-noto-bengali",
});

export async function generateMetadata(): Promise<Metadata> {
  const resolution = await currentSiteResolution();
  if (resolution === undefined) {
    return buildLayoutMetadata({ canonicalHostname: undefined });
  }
  const site = await readPublic<StorefrontSiteResponse>(`/orgs/${resolution.organizationId}/site`);
  return buildLayoutMetadata({
    canonicalHostname: resolution.canonicalHostname,
    title: site?.name ?? brandName(),
  });
}

interface SiteFrame {
  readonly site: StorefrontSiteResponse;
  readonly customer: StorefrontMeResponse | undefined;
  readonly organizationId: string;
}

/** The business's header and footer data, or undefined for a host that has no business. */
async function readSiteFrame(organizationId: string | undefined): Promise<SiteFrame | undefined> {
  if (organizationId === undefined) return undefined;
  const site = await readPublic<StorefrontSiteResponse>(`/orgs/${organizationId}/site`);
  if (site === undefined) return undefined;
  const customer = site.features.customerLogin
    ? await readSignedInCustomer<StorefrontMeResponse>(`/orgs/${organizationId}/me`)
    : undefined;
  return { site, customer, organizationId };
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const { locale, translator } = await storefrontTranslator();
  const organizationId = organizationIdFrom(await headers());
  const frame = await readSiteFrame(organizationId);
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${notoSansBengali.variable}`}
      style={themeStyle(frame?.site.colors)}
    >
      <body className="min-h-screen bg-app text-primary">
        <a href="#main" className="sr-only focus:not-sr-only">
          {translator.t("storefront.nav.skipToContent")}
        </a>
        {frame ? (
          <SiteHeader
            site={frame.site}
            locale={locale}
            translator={translator}
            organizationId={frame.organizationId}
            customer={frame.customer}
          />
        ) : null}
        <main id="main" className="mx-auto w-full max-w-5xl px-4 py-6">
          {children}
        </main>
        {frame ? <SiteFooter site={frame.site} locale={locale} translator={translator} /> : null}
        {frame?.site.features.customerLogin && frame.customer === undefined ? (
          <SessionRenewer organizationId={frame.organizationId} />
        ) : null}
      </body>
    </html>
  );
}
