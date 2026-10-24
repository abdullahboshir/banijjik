import { BUNDLED_CATALOGS, SCREEN_CATALOGS, type Catalog } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { getLocale } from "@banijjik/web-client/server";
import type { ReactElement, ReactNode } from "react";
import { env } from "../config/env";

/** Screen-catalog prefixes the commission client components read through `useTranslator`. */
const CLIENT_KEY_PREFIXES = ["commission.", "catalog.kind."] as const;

function commissionClientCatalog(screenCatalog: Catalog, bundledCatalog: Catalog): Catalog {
  const screenEntries = Object.entries(screenCatalog).filter(([key]) =>
    CLIENT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)),
  );
  return { ...bundledCatalog, ...Object.fromEntries(screenEntries) };
}

/**
 * Sends the commission screens' own text to the browser for these routes only. The screen catalogs stay out
 * of every other page's first load (13-UX section 11), so the client components here get them from a nested
 * provider instead of the bundled catalog.
 */
export async function CommissionClientText(props: { children: ReactNode }): Promise<ReactElement> {
  const locale = await getLocale();
  return (
    <I18nProvider
      locale={locale}
      catalog={commissionClientCatalog(SCREEN_CATALOGS[locale], BUNDLED_CATALOGS[locale])}
      brandName={env.NEXT_PUBLIC_BRAND_NAME}
    >
      {props.children}
    </I18nProvider>
  );
}
