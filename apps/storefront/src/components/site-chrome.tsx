import type { StorefrontMeResponse } from "@banijjik/contracts/contact";
import type { StorefrontSiteResponse } from "@banijjik/contracts/website";
import { LogoImage } from "@banijjik/ui";
import type { Locale, Translator } from "@banijjik/i18n";
import Link from "next/link";
import type { ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";
import { PAGE_PATH_PREFIX, slugOfPageKey } from "../static-pages/page-routes";
import { SignOutButton } from "./sign-out-button";

export interface SiteChromeProps {
  readonly site: StorefrontSiteResponse;
  readonly locale: Locale;
  readonly translator: Translator;
  readonly organizationId: string;
  readonly customer: StorefrontMeResponse | undefined;
}

const LANGUAGES: readonly Locale[] = ["bn", "en"];

function LanguageLinks({
  translator,
  locale,
}: {
  translator: Translator;
  locale: Locale;
}): ReactElement {
  return (
    <nav aria-label="Language" className="flex items-center gap-2 text-small">
      {LANGUAGES.map((language) => (
        <a
          key={language}
          href={`/language?to=${language}`}
          aria-current={language === locale ? "true" : undefined}
          className={
            language === locale ? "font-semibold text-primary" : "text-secondary underline"
          }
        >
          {translator.t(`storefront.language.${language}`)}
        </a>
      ))}
    </nav>
  );
}

function AccountArea({
  site,
  translator,
  customer,
}: Pick<SiteChromeProps, "site" | "translator" | "customer">): ReactElement | null {
  if (!site.features.customerLogin) return null;
  if (customer === undefined) {
    return (
      <Link href="/sign-in" className="text-body font-semibold text-brand">
        {translator.t("storefront.nav.signIn")}
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-small">
      <span className="text-secondary">
        {translator.t("storefront.nav.signedInAs", { name: customer.name ?? customer.phoneE164 })}
      </span>
      <SignOutButton organizationId={site.organizationId} locale={translator.locale} />
    </div>
  );
}

/** The top of every page: the business's logo and name, its navigation, language and account. */
export function SiteHeader(props: SiteChromeProps): ReactElement {
  const { site, locale, translator } = props;
  return (
    <header className="border-b border-default bg-surface">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            {site.logoUrl ? (
              <LogoImage
                src={site.logoUrl}
                alt={site.name}
                className="h-10 w-10 rounded object-contain"
              />
            ) : null}
            <span className="flex min-w-0 flex-col">
              <span className="text-title truncate font-semibold text-primary">{site.name}</span>
              {site.tagline ? (
                <span className="text-small text-secondary">{site.tagline}</span>
              ) : null}
            </span>
          </Link>
          <LanguageLinks translator={translator} locale={locale} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label={translator.t("storefront.nav.pages")}
            className="flex flex-wrap gap-4 text-body"
          >
            <Link href="/" className="font-semibold text-primary">
              {translator.t("storefront.nav.home")}
            </Link>
            {site.features.directory ? (
              <Link href="/search" className="font-semibold text-primary">
                {translator.t("storefront.nav.search")}
              </Link>
            ) : null}
            {site.pages.map((page) => (
              <Link
                key={page.pageKey}
                href={`${PAGE_PATH_PREFIX}/${slugOfPageKey(page.pageKey)}`}
                className="text-secondary"
              >
                {localizedText(page.title, locale)}
              </Link>
            ))}
          </nav>
          <AccountArea site={site} translator={translator} customer={props.customer} />
        </div>
      </div>
    </header>
  );
}

/** The bottom of every page: the business's name and its published pages. */
export function SiteFooter({
  site,
  locale,
  translator,
}: Omit<SiteChromeProps, "organizationId" | "customer">): ReactElement {
  return (
    <footer className="mt-12 border-t border-default bg-subtle">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-small text-secondary">
        <span className="font-semibold text-primary">{site.name}</span>
        <nav aria-label={translator.t("storefront.nav.pages")} className="flex flex-wrap gap-4">
          {site.pages.map((page) => (
            <Link
              key={page.pageKey}
              href={`${PAGE_PATH_PREFIX}/${slugOfPageKey(page.pageKey)}`}
              className="underline"
            >
              {localizedText(page.title, locale)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
