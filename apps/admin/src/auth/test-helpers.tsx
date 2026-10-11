import {
  BUNDLED_CATALOGS,
  createTranslator,
  SCREEN_CATALOGS,
  type Translator,
} from "@banijjik/i18n";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider } from "../lib/i18n/i18n-provider";

/** Bangla catalog text by key, so tests name what the person reads without copying the catalog. */
export function banglaText(messageKey: string): string {
  const text = BUNDLED_CATALOGS.bn[messageKey] ?? SCREEN_CATALOGS.bn[messageKey];
  if (text === undefined) throw new Error(`Missing Bangla message ${messageKey}`);
  return text;
}

export function renderInBangla(element: ReactElement): void {
  render(
    <I18nProvider locale="bn" brandName="Example">
      {element}
    </I18nProvider>,
  );
}

/** The Bangla translator the server pages use: bundled and screen catalogs together. */
export function banglaTranslator(): Translator {
  return createTranslator({ locale: "bn", brandName: "Example", catalogs: SCREEN_CATALOGS });
}
