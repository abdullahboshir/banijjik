import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { env } from "../src/config/env";
import { getLocale } from "../src/i18n/get-locale";
import { getTranslator } from "../src/i18n/get-translator";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  adjustFontFallback: true,
  preload: false,
  variable: "--font-inter",
});
const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "600"],
  adjustFontFallback: true,
  display: "swap",
  variable: "--font-noto-bengali",
});

export const metadata: Metadata = { title: env.NEXT_PUBLIC_BRAND_NAME };

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const [locale, { t }] = await Promise.all([getLocale(), getTranslator()]);
  return (
    <html lang={locale} className={`${inter.variable} ${notoSansBengali.variable}`}>
      <body>
        {/* On every page, so nobody mistakes this app for a tenant's dashboard (13-UX section 12). */}
        <div className="bg-brand px-4 py-1 text-center text-small font-semibold text-on-brand">
          {t("platform.band")}
        </div>
        <Providers
          locale={locale}
          catalog={BUNDLED_CATALOGS[locale]}
          brandName={env.NEXT_PUBLIC_BRAND_NAME}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
