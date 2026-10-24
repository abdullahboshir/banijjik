"use client";

import { isSupportedLocale, type Locale } from "@banijjik/i18n";
import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";
import { translatorFor } from "../src/i18n/client-translator";

const DEFAULT_CLIENT_LOCALE: Locale = "bn";

/** The page failed on the server or in the browser: say so in the visitor's language, and offer a retry. */
export default function ErrorPage({
  reset,
}: {
  readonly error: Error;
  readonly reset: () => void;
}): ReactElement {
  const { t } = translatorFor(clientLocale());
  return (
    <section className="flex flex-col gap-3 py-8">
      <h1 className="text-title font-semibold text-primary">{t("storefront.error.title")}</h1>
      <p className="text-body text-secondary">{t("storefront.error.message")}</p>
      <div>
        <Button variant="primary" onClick={reset}>
          {t("storefront.error.retry")}
        </Button>
      </div>
    </section>
  );
}

/** The language the server rendered the page in: the `lang` attribute it wrote on the page. */
function clientLocale(): Locale {
  // The error page can also render on the server, where no document exists yet.
  if (typeof document === "undefined") return DEFAULT_CLIENT_LOCALE;
  const lang = document.documentElement.lang;
  return isSupportedLocale(lang) ? lang : DEFAULT_CLIENT_LOCALE;
}
