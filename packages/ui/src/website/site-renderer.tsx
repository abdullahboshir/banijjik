import type { SiteDesign, SitePage, SiteSection } from "@banijjik/contracts/website";
import type { ReactElement } from "react";
import { copyText, type SiteLocale } from "./copy-text.js";
import { renderSiteSection } from "./section-renderers.js";
import { siteThemeStyle } from "./theme-style.js";

export interface SiteRendererProps {
  readonly design: SiteDesign;
  readonly locale: SiteLocale;
  readonly effectiveSectionKeys: readonly string[];
  readonly pagePath?: string;
}

function isAllowedSection(section: SiteSection, effectiveSectionKeys: readonly string[]): boolean {
  return effectiveSectionKeys.includes(section.sectionKey);
}

function pageOf(design: SiteDesign, pagePath: string | undefined): SitePage | undefined {
  if (pagePath === undefined) return design.pages[0];
  return design.pages.find((page) => page.path === pagePath);
}

function SectionList({
  sections,
  locale,
  effectiveSectionKeys,
}: {
  readonly sections: readonly SiteSection[];
  readonly locale: SiteLocale;
  readonly effectiveSectionKeys: readonly string[];
}): ReactElement {
  return (
    <>
      {sections.map((section) => {
        if (!isAllowedSection(section, effectiveSectionKeys)) return null;
        const rendered = renderSiteSection({ section, locale });
        return rendered === null ? null : (
          <div key={section.sectionId} className="min-w-0 max-w-full">
            {rendered}
          </div>
        );
      })}
    </>
  );
}

/**
 * Shared preview/SSR of a site design. CSS comes from the token map; live-data sections are
 * omitted until their modules register readers (decision 11).
 */
export function SiteRenderer({
  design,
  locale,
  effectiveSectionKeys,
  pagePath,
}: SiteRendererProps): ReactElement {
  const page = pageOf(design, pagePath);
  const title = page === undefined ? "" : copyText(page.title, locale);
  const hasHero = page?.sections.some((section) => section.sectionKey === "hero") === true;
  return (
    <div
      className="flex min-h-screen min-w-0 flex-col bg-[var(--site-color-background)] text-[var(--site-color-text)]"
      style={siteThemeStyle(design.tokens)}
    >
      {isAllowedSection(design.header, effectiveSectionKeys)
        ? renderSiteSection({ section: design.header, locale })
        : null}
      <main
        id="main"
        className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-[var(--site-space)] px-4 py-6"
      >
        {title !== "" && !hasHero ? (
          <h1 className="text-display max-w-full break-words font-semibold">{title}</h1>
        ) : null}
        {page ? (
          <SectionList
            sections={page.sections}
            locale={locale}
            effectiveSectionKeys={effectiveSectionKeys}
          />
        ) : null}
      </main>
      {isAllowedSection(design.footer, effectiveSectionKeys)
        ? renderSiteSection({ section: design.footer, locale })
        : null}
    </div>
  );
}
