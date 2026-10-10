"use client";

import { createTranslator, type Locale, type Translator } from "@banijjik/i18n";
import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from "react";

const I18nContext = createContext<Translator | undefined>(undefined);

export interface I18nProviderProps {
  locale: Locale;
  brandName: string;
  children: ReactNode;
}

/** Gives client components the same translator the server uses. Static text still arrives as props. */
export function I18nProvider({ locale, brandName, children }: I18nProviderProps): ReactElement {
  const translator = useMemo(
    () => createTranslator({ locale, terms: {}, brandName }),
    [locale, brandName],
  );
  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>;
}

export function useTranslator(): Translator {
  const translator = useContext(I18nContext);
  if (!translator) throw new Error("useTranslator must be used inside I18nProvider");
  return translator;
}
