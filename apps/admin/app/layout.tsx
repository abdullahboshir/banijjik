import { Inter, Noto_Sans_Bengali } from "next/font/google";
import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { env } from "../src/config/env";
import { getLocale } from "../src/lib/i18n/get-locale";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  display: "swap",
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
        <Providers locale={locale} brandName={env.NEXT_PUBLIC_BRAND_NAME}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
