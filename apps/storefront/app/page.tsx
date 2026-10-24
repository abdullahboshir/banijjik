import type { StorefrontDirectoryStatsResponse } from "@banijjik/contracts/directory";
import type { StorefrontSiteResponse } from "@banijjik/contracts/website";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { readPublic } from "../src/api/storefront-api";
import { HomeStats } from "../src/components/home-stats";
import { storefrontTranslator } from "../src/i18n/translator";
import { localizedText } from "../src/i18n/localized-text";
import { PAGE_PATH_PREFIX, slugOfPageKey } from "../src/static-pages/page-routes";
import { requireOrganizationId } from "../src/site/current-site";

export default async function HomePage(): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  const { locale, translator } = await storefrontTranslator();
  const site = await readPublic<StorefrontSiteResponse>(`/orgs/${organizationId}/site`);
  if (site === undefined) notFound();
  const stats = site.features.directory
    ? await readPublic<StorefrontDirectoryStatsResponse>(`/orgs/${organizationId}/directory/stats`)
    : undefined;
  const about = site.pages.find((page) => page.pageKey === "ABOUT");
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-display font-semibold text-primary">
          {about ? localizedText(about.title, locale) : site.name}
        </h1>
        {about ? (
          <Link
            href={`${PAGE_PATH_PREFIX}/${slugOfPageKey(about.pageKey)}`}
            className="text-accent underline"
          >
            {translator.t("storefront.home.aboutLink")}
          </Link>
        ) : null}
        {site.features.directory ? (
          <Link
            href="/search"
            className="inline-flex min-h-11 w-fit items-center rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-hover"
          >
            {translator.t("storefront.home.browse")}
          </Link>
        ) : null}
      </section>
      {stats ? <HomeStats stats={stats} locale={locale} translator={translator} /> : null}
    </div>
  );
}
