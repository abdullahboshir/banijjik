import { I18nProvider } from "@banijjik/web-client/client";
import {
  BUNDLED_CATALOGS,
  PLATFORM_SCREEN_CATALOGS,
  createTranslator,
  type Translator,
} from "@banijjik/i18n";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { banglaText } from "./bangla-text";

export { banglaText };

export function renderInBangla(element: ReactElement): void {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      {element}
    </I18nProvider>,
  );
}

/** The Bangla translator the server pages use: bundled and platform catalogs together. */
export function banglaTranslator(): Translator {
  return createTranslator({
    locale: "bn",
    brandName: "Example",
    catalogs: PLATFORM_SCREEN_CATALOGS,
  });
}
