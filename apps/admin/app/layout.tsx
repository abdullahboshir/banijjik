import { getLocale } from "@banijjik/web-client/server";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import localFont from "next/font/local";
import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { env } from "../src/config/env";
import { Providers } from "./providers";
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

export const metadata: Metadata = { title: env.NEXT_PUBLIC_BRAND_NAME };

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${notoSansBengali.variable}`}>
      <body>
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
