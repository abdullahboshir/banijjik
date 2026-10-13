"use client";

import { SUPPORTED_LOCALES } from "@banijjik/i18n";
import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";
import { useTranslator } from "./i18n-provider.js";
import { useLocaleChange } from "./use-locale-change.js";

export interface LanguageSwitchProps {
  /** The app's server action that stores the chosen language. */
  setLocale: (localeKey: string) => Promise<unknown>;
  /** Extra classes for every language button (the platform app narrows them on small screens). */
  buttonClassName?: string;
}

function joinButtonClassNames(
  isActive: boolean,
  extraClassName: string | undefined,
): string | undefined {
  const classNames = [isActive ? "bg-subtle" : undefined, extraClassName];
  const joined = classNames.filter((className) => className !== undefined).join(" ");
  return joined === "" ? undefined : joined;
}

/** The language buttons for pages that have no account menu (sign-in and sign-up). */
export function LanguageSwitch({
  setLocale,
  buttonClassName: extraButtonClassName,
}: LanguageSwitchProps): ReactElement {
  const { t, locale } = useTranslator();
  const changeLocale = useLocaleChange(setLocale);
  return (
    <div role="group" aria-label={t("account.language")} className="flex gap-1">
      {SUPPORTED_LOCALES.map((localeKey) => (
        <Button
          key={localeKey}
          variant="ghost"
          aria-pressed={localeKey === locale}
          className={joinButtonClassNames(localeKey === locale, extraButtonClassName)}
          onClick={() => changeLocale(localeKey)}
        >
          {t(`language.${localeKey}`)}
        </Button>
      ))}
    </div>
  );
}
