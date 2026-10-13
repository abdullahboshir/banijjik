import { I18nProvider } from "@banijjik/web-client/client";
import {
  BUNDLED_CATALOGS,
  createTranslator,
  SCREEN_CATALOGS,
  type Translator,
} from "@banijjik/i18n";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { registerMessageCheck } from "./field-errors";

/** Bangla catalog text by key, so tests name what the person reads without copying the catalog. */
export function banglaText(messageKey: string): string {
  const text = BUNDLED_CATALOGS.bn[messageKey] ?? SCREEN_CATALOGS.bn[messageKey];
  if (text === undefined) throw new Error(`Missing Bangla message ${messageKey}`);
  return text;
}

export function renderInBangla(element: ReactElement): void {
  render(
    <I18nProvider
      locale="bn"
      catalog={BUNDLED_CATALOGS.bn}
      brandName="Example"
      onTranslatorCreated={registerCatalog}
    >
      {element}
    </I18nProvider>,
  );
}

function registerCatalog(translator: Translator): void {
  registerMessageCheck(translator.has);
}

/** The Bangla translator the server pages use: bundled and screen catalogs together. */
export function banglaTranslator(): Translator {
  return createTranslator({ locale: "bn", brandName: "Example", catalogs: SCREEN_CATALOGS });
}
