import { SECTION_KEY, isStaticSectionKey, type SiteSection } from "@banijjik/contracts/website";
import type { ReactElement } from "react";
import { PublicImage } from "../components/public-image.js";
import { cn } from "../lib/cn.js";
import { renderMarkdown } from "../markdown/render-markdown.js";
import {
  copyText,
  mailtoHref,
  publicHref,
  publicImageSrc,
  telHref,
  type SiteLocale,
} from "./copy-text.js";

export const SITE_CHROME_LINK_CLASS =
  "inline-flex min-h-11 min-w-0 max-w-full items-center break-words px-1 text-body";

export interface SectionRenderProps {
  readonly section: SiteSection;
  readonly locale: SiteLocale;
}

function MarkdownBody({ source }: { readonly source: string }): ReactElement {
  // Safe Markdown policy already escapes raw HTML and drops javascript:/data: links.
  return (
    <div
      className="page-body min-w-0 max-w-full break-words text-body"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}

function NavLinks({
  links,
  locale,
  label,
}: {
  readonly links: readonly { readonly label: { bn: string; en: string }; readonly path: string }[];
  readonly locale: SiteLocale;
  readonly label: string;
}): ReactElement {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {links.map((link) => {
        const href = publicHref(link.path);
        const name = copyText(link.label, locale);
        if (href === undefined) return null;
        return (
          <a key={`${href}:${name}`} href={href} className={SITE_CHROME_LINK_CLASS}>
            {name}
          </a>
        );
      })}
    </nav>
  );
}

function HeaderSection({ section, locale }: SectionRenderProps): ReactElement | null {
  if (section.sectionKey !== SECTION_KEY.header) return null;
  const centered = section.variantKey === "CENTERED";
  return (
    <header className={cn("w-full min-w-0", centered && "text-center")}>
      <NavLinks links={section.content.links} locale={locale} label="Site" />
    </header>
  );
}

function FooterSection({ section, locale }: SectionRenderProps): ReactElement | null {
  if (section.sectionKey !== SECTION_KEY.footer) return null;
  const columns = section.variantKey === "COLUMNS";
  return (
    <footer className="w-full min-w-0">
      <NavLinks links={section.content.links} locale={locale} label="Footer" />
      {columns ? <div className="h-0" aria-hidden="true" /> : null}
    </footer>
  );
}

function HeroSection({ section, locale }: SectionRenderProps): ReactElement | null {
  if (section.sectionKey !== SECTION_KEY.hero) return null;
  const heading = copyText(section.content.heading, locale);
  const body = copyText(section.content.body, locale);
  const action = copyText(section.content.actionLabel ?? { bn: "", en: "" }, locale);
  const href = publicHref(section.content.actionPath);
  const imageSrc = publicImageSrc(section.content.imageFileId);
  const split = section.variantKey === "SPLIT";
  return (
    <section className={cn("grid min-w-0 gap-[var(--site-space)]", split && "md:grid-cols-2")}>
      <div className="min-w-0">
        <h1 className="text-display max-w-full break-words font-semibold">{heading}</h1>
        {body ? <MarkdownBody source={body} /> : null}
        {href !== undefined && action !== "" ? (
          <a href={href} className={cn(SITE_CHROME_LINK_CLASS, "font-semibold")}>
            {action}
          </a>
        ) : null}
      </div>
      {imageSrc !== undefined ? (
        <PublicImage
          src={imageSrc}
          alt={heading}
          className="aspect-[var(--site-image-ratio)] w-full rounded-[var(--site-radius-image)] object-cover"
        />
      ) : null}
    </section>
  );
}

function RichTextSection({ section, locale }: SectionRenderProps): ReactElement | null {
  if (section.sectionKey !== SECTION_KEY["rich-text"]) return null;
  const narrow = section.variantKey === "NARROW";
  return (
    <section className={cn("min-w-0", narrow && "mx-auto max-w-prose")}>
      <MarkdownBody source={copyText(section.content.body, locale)} />
    </section>
  );
}

function FaqSection({ section, locale }: SectionRenderProps): ReactElement | null {
  if (section.sectionKey !== SECTION_KEY.faq) return null;
  const accordion = section.variantKey === "ACCORDION";
  return (
    <section className="flex min-w-0 flex-col gap-3">
      {section.content.entries.map((entry, index) => {
        const question = copyText(entry.question, locale);
        const answer = copyText(entry.answer, locale);
        if (accordion) {
          return (
            <details
              key={`${question}:${index}`}
              className="min-w-0 rounded-md border border-default p-3"
            >
              <summary className="min-h-11 cursor-pointer break-words font-semibold">
                {question}
              </summary>
              <MarkdownBody source={answer} />
            </details>
          );
        }
        return (
          <div key={`${question}:${index}`} className="min-w-0">
            <h2 className="text-title break-words font-semibold">{question}</h2>
            <MarkdownBody source={answer} />
          </div>
        );
      })}
    </section>
  );
}

function TestimonialsSection({ section, locale }: SectionRenderProps): ReactElement | null {
  if (section.sectionKey !== SECTION_KEY.testimonials) return null;
  const cards = section.variantKey === "CARDS";
  return (
    <section className="grid min-w-0 gap-3">
      {section.content.entries.map((entry, index) => {
        const quote = copyText(entry.quote, locale);
        const attribution = copyText(entry.attribution, locale);
        return (
          <figure
            key={`${attribution}:${index}`}
            className={cn("min-w-0 break-words", cards && "rounded-md border border-default p-4")}
          >
            <blockquote className="text-body">{quote}</blockquote>
            <figcaption className="text-small text-secondary">{attribution}</figcaption>
          </figure>
        );
      })}
    </section>
  );
}

function ContactSection({ section, locale }: SectionRenderProps): ReactElement | null {
  if (section.sectionKey !== SECTION_KEY.contact) return null;
  const heading = copyText(section.content.heading, locale);
  const address = section.content.address ? copyText(section.content.address, locale) : "";
  const split = section.variantKey === "SPLIT";
  const phoneHref = telHref(section.content.phone);
  const emailHref = mailtoHref(section.content.email);
  return (
    <section className={cn("min-w-0 break-words", split && "grid gap-3 md:grid-cols-2")}>
      <h2 className="text-title font-semibold">{heading}</h2>
      <div className="flex flex-col gap-2">
        {phoneHref !== undefined ? (
          <a href={phoneHref} className={SITE_CHROME_LINK_CLASS}>
            {section.content.phone}
          </a>
        ) : null}
        {emailHref !== undefined ? (
          <a href={emailHref} className={SITE_CHROME_LINK_CLASS}>
            {section.content.email}
          </a>
        ) : null}
        {address ? <p className="text-body">{address}</p> : null}
      </div>
    </section>
  );
}

const STATIC_RENDERERS: Readonly<
  Record<string, (props: SectionRenderProps) => ReactElement | null>
> = {
  [SECTION_KEY.header]: HeaderSection,
  [SECTION_KEY.footer]: FooterSection,
  [SECTION_KEY.hero]: HeroSection,
  [SECTION_KEY["rich-text"]]: RichTextSection,
  [SECTION_KEY.faq]: FaqSection,
  [SECTION_KEY.testimonials]: TestimonialsSection,
  [SECTION_KEY.contact]: ContactSection,
};

/** Static sections only (decision 11). Catalog, booking and directory wait for their readers. */
export function renderSiteSection(props: SectionRenderProps): ReactElement | null {
  if (!isStaticSectionKey(props.section.sectionKey)) return null;
  const Renderer = STATIC_RENDERERS[props.section.sectionKey];
  return Renderer === undefined ? null : Renderer(props);
}
