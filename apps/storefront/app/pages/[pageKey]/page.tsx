import type { Metadata } from "next";
import type { StorefrontSitePageResponse } from "@banijjik/contracts/website";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { readPublic } from "../../../src/api/storefront-api";
import { storefrontTranslator } from "../../../src/i18n/translator";
import { localizedText } from "../../../src/i18n/localized-text";
import { renderMarkdown } from "@banijjik/ui/markdown";
import { PAGE_PATH_PREFIX, pageKeyOfSlug } from "../../../src/static-pages/page-routes";
import { currentSiteResolution, requireOrganizationId } from "../../../src/site/current-site";
import { buildPageMetadata } from "../../../src/site/site-metadata";
import { brandName } from "../../../src/config/environment";

interface StaticPageProps {
  readonly params: Promise<{ readonly pageKey: string }>;
}

export async function generateMetadata({ params }: StaticPageProps): Promise<Metadata> {
  const { pageKey: slug } = await params;
  const pageKey = pageKeyOfSlug(slug);
  const resolution = await currentSiteResolution();
  if (resolution === undefined || pageKey === undefined) {
    return buildPageMetadata({
      canonicalHostname: undefined,
      title: brandName(),
      path: `/${slug}`,
    });
  }
  const { locale } = await storefrontTranslator();
  const page = await readPublic<StorefrontSitePageResponse>(
    `/orgs/${resolution.organizationId}/pages/${pageKey}`,
  );
  if (page === undefined) {
    return buildPageMetadata({
      canonicalHostname: undefined,
      title: brandName(),
      path: `${PAGE_PATH_PREFIX}/${slug}`,
    });
  }
  return buildPageMetadata({
    canonicalHostname: resolution.canonicalHostname,
    title: localizedText(page.title, locale),
    path: `${PAGE_PATH_PREFIX}/${slug}`,
  });
}

/** A published static page (M.6 decision 1). The body is Markdown and is rendered without raw HTML. */
export default async function StaticPage({ params }: StaticPageProps): Promise<ReactElement> {
  const { pageKey: slug } = await params;
  const pageKey = pageKeyOfSlug(slug);
  if (pageKey === undefined) notFound();
  const organizationId = await requireOrganizationId();
  const { locale } = await storefrontTranslator();
  const page = await readPublic<StorefrontSitePageResponse>(
    `/orgs/${organizationId}/pages/${pageKey}`,
  );
  if (page === undefined) notFound();
  return (
    <article className="flex flex-col gap-2">
      <h1 className="text-display font-semibold text-primary">
        {localizedText(page.title, locale)}
      </h1>
      <div
        className="page-body text-body text-secondary"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(localizedText(page.body, locale)) }}
      />
    </article>
  );
}
