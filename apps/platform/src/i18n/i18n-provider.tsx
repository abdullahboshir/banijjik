"use client";

import {
  createCatalogTranslator,
  type Catalog,
  type Locale,
  type Translator,
} from "@banijjik/i18n";
import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from "react";

const I18nContext = createContext<Translator | undefined>(undefined);

export interface I18nProviderProps {
  locale: Locale;
  /** The bundled catalog of `locale`, read on the server: the browser bundle holds no catalog of its own. */
  catalog: Catalog;
  brandName: string;
  children: ReactNode;
}

/** Gives client components the same translator the server uses. Platform screen text arrives as props. */
export function I18nProvider({
  locale,
  catalog,
  brandName,
  children,
}: I18nProviderProps): ReactElement {
  const translator = useMemo(
    () => createCatalogTranslator(catalog, { locale, terms: {}, brandName }),
    [locale, catalog, brandName],
  );
  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>;
}

export function useTranslator(): Translator {
  const translator = useContext(I18nContext);
  if (!translator) throw new Error("useTranslator must be used inside I18nProvider");
  return translator;
}
