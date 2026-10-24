import type { StorefrontSitePageResponse } from "@banijjik/contracts/website";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { readPublic } from "../../../src/api/storefront-api";
import { storefrontTranslator } from "../../../src/i18n/translator";
import { localizedText } from "../../../src/i18n/localized-text";
import { renderMarkdown } from "../../../src/markdown/render-markdown";
import { pageKeyOfSlug } from "../../../src/pages/page-routes";
import { requireOrganizationId } from "../../../src/site/current-site";

interface StaticPageProps {
  readonly params: Promise<{ readonly pageKey: string }>;
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
