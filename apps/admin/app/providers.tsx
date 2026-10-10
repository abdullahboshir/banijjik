"use client";

import type { Locale } from "@banijjik/i18n";
import { LinkComponentProvider } from "@banijjik/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useState, type ReactElement, type ReactNode } from "react";
import { LazyToaster } from "../src/shell/lazy-toaster";
import { ShellLink } from "../src/shell/shell-link";
import { ApiError } from "../src/lib/api/api-error";
import { I18nProvider, useTranslator } from "../src/lib/i18n/i18n-provider";

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

export interface ProvidersProps {
  locale: Locale;
  brandName: string;
  children: ReactNode;
}

export function Providers({ locale, brandName, children }: ProvidersProps): ReactElement {
  const [queryClient] = useState(createQueryClient);
  return (
    <I18nProvider locale={locale} brandName={brandName}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider component={ShellLink}>
          {children}
          <TranslatedToaster />
        </LinkComponentProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
