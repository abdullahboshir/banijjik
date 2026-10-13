"use client";

import { I18nProvider, useTranslator, LazyToaster, ShellLink } from "@banijjik/web-client/client";
import type { Catalog, Locale } from "@banijjik/i18n";
import { LinkComponentProvider } from "@banijjik/ui";
import type { ReactElement, ReactNode } from "react";

function TranslatedToaster(): ReactElement {
  const { t } = useTranslator();
  return <LazyToaster label={t("shell.notifications")} />;
}

export interface ProvidersProps {
  locale: Locale;
  catalog: Catalog;
  brandName: string;
  children: ReactNode;
}

export function Providers({ locale, catalog, brandName, children }: ProvidersProps): ReactElement {
  return (
    <I18nProvider locale={locale} catalog={catalog} brandName={brandName}>
      <LinkComponentProvider component={ShellLink}>
        {children}
        <TranslatedToaster />
      </LinkComponentProvider>
    </I18nProvider>
  );
}
