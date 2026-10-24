import MarkdownIt from "markdown-it";

/**
 * Static pages are Markdown written by the business (M.6 decision 12). Raw HTML is never rendered: with
 * `html: false` markdown-it escapes it into visible text. Only http, https and mailto links survive; any
 * other target (javascript:, data:, relative paths) is left as plain text, never as a link.
 */
const ALLOWED_LINK_PATTERN = /^(https?:|mailto:)/i;
const LINK_ATTRIBUTES_REL = "nofollow noopener noreferrer";

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });

markdown.validateLink = (url: string): boolean => ALLOWED_LINK_PATTERN.test(url.trim());

markdown.renderer.rules["link_open"] = (tokens, index, options) => {
  tokens[index]?.attrSet("rel", LINK_ATTRIBUTES_REL);
  return markdown.renderer.renderToken(tokens, index, options);
};

/** Renders a page body to HTML that is safe to place in the page. */
export function renderMarkdown(source: string): string {
  return markdown.render(source);
}
