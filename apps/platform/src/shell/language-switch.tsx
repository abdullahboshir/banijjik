"use client";

import { SUPPORTED_LOCALES } from "@banijjik/i18n";
import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";
import { useTranslator } from "../i18n/i18n-provider";
import { useLocaleChange } from "./use-locale-change";

/** The language buttons for pages that have no account menu (sign-in and sign-up). */
export function LanguageSwitch(): ReactElement {
  const { t, locale } = useTranslator();
  const changeLocale = useLocaleChange();
  return (
    <div role="group" aria-label={t("account.language")} className="flex gap-1">
      {SUPPORTED_LOCALES.map((localeKey) => (
        <Button
          key={localeKey}
          variant="ghost"
          aria-pressed={localeKey === locale}
          className={localeKey === locale ? "bg-subtle" : undefined}
          onClick={() => changeLocale(localeKey)}
        >
          {t(`language.${localeKey}`)}
        </Button>
      ))}
    </div>
  );
}
