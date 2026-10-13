"use client";

import { LazyToaster, ShellLink, I18nProvider, useTranslator } from "@banijjik/web-client/client";
import type { Catalog, Locale, Translator } from "@banijjik/i18n";
import { LinkComponentProvider } from "@banijjik/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useState, type ReactElement, type ReactNode } from "react";
import { registerMessageCheck } from "../src/auth/field-errors";
import { ApiError } from "../src/lib/api/api-error";

const QUERY_STALE_TIME_MS = 30_000;
const MAX_QUERY_RETRIES = 2;

/** Client errors (4xx) will not change on retry; only network and 5xx failures are retried. */
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  return !(error instanceof ApiError && error.status >= 400 && error.status < 500);
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
      },
    },
  });
}

function TranslatedToaster(): ReactElement {
  const { t } = useTranslator();
  return <LazyToaster label={t("shell.notifications")} />;
}

/** The catalog check used outside React (unknown API keys fall back to the generic error). */
function registerCatalog(translator: Translator): void {
  registerMessageCheck(translator.has);
}

export interface ProvidersProps {
  locale: Locale;
  catalog: Catalog;
  brandName: string;
  children: ReactNode;
}

export function Providers({ locale, catalog, brandName, children }: ProvidersProps): ReactElement {
  const [queryClient] = useState(createQueryClient);
  return (
    <I18nProvider
      locale={locale}
      catalog={catalog}
      brandName={brandName}
      onTranslatorCreated={registerCatalog}
    >
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider component={ShellLink}>
          {children}
          <TranslatedToaster />
        </LinkComponentProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
