import type { Translator, TranslationValues } from "@banijjik/i18n";

/** The text a client component needs, looked up on the server: one translated string per key. */
export type Labels<Key extends string> = Readonly<Record<Key, string>>;

/**
 * Translates the given keys on the server so a client component can receive them as props. Each client
 * component exports its own key list; a test checks that every listed key exists in both languages.
 * `values` fills the placeholders of every key (for example the tenant name in a dialog title).
 */
export function pickLabels<const Keys extends readonly string[]>(
  t: Translator["t"],
  keys: Keys,
  values?: TranslationValues,
): Labels<Keys[number]> {
  // Safe: the object is built from exactly the keys of the list, so it has every one of them.
  return Object.fromEntries(keys.map((key) => [key, t(key, values)])) as Labels<Keys[number]>;
}
