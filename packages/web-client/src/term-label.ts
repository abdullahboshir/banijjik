/** The business's terms as `/me/config` carries them: both languages, but a client tolerates a missing one. */
export type TermTexts = Readonly<
  Record<string, { readonly bn?: string | undefined; readonly en?: string | undefined }>
>;

/**
 * The text of a business term in the user's language (ADR-104), or `view.fallback` when the business has none.
 * One helper for menus and page titles, so a renamed term shows the same word everywhere. It lives in the
 * shared entry, not the client one, because server components call it.
 */
export function termLabel(
  terms: TermTexts,
  termKey: string,
  view: { readonly locale: "bn" | "en"; readonly fallback: string },
): string {
  const { locale, fallback } = view;
  // `hasOwn`: a term key such as "constructor" must never read the prototype.
  if (!Object.hasOwn(terms, termKey)) return fallback;
  const text = terms[termKey]?.[locale]?.trim();
  return text === undefined || text === "" ? fallback : text;
}
