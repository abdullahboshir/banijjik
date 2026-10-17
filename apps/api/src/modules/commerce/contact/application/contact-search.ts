import { foldName } from "../domain/name-search.js";
import type { ContactSearch } from "./ports/contact-repository.js";

const BD_COUNTRY_PREFIX = "+880";
const BD_COUNTRY_DIGITS = "880";
const MIN_PHONE_DIGITS = 3;
const PHONE_LOOKING = /^\+?[\d\s\-().]+$/;
const NON_PHONE_CHARACTERS = /[^\d+]/g;

/**
 * The E.164 prefix a typed phone fragment stands for, or undefined when the text is not a phone
 * fragment. `017…`, `8801…`, `+8801…` and `1712…` all reach the same stored `+88017…` numbers.
 */
function phonePrefixOf(text: string): string | undefined {
  if (!PHONE_LOOKING.test(text)) return undefined;
  const compact = text.replace(NON_PHONE_CHARACTERS, "");
  if (compact.replace("+", "").length < MIN_PHONE_DIGITS) return undefined;
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith(BD_COUNTRY_DIGITS)) return `+${compact}`;
  if (compact.startsWith("0")) return `${BD_COUNTRY_PREFIX}${compact.slice(1)}`;
  if (compact.startsWith("1")) return `${BD_COUNTRY_PREFIX}${compact}`;
  return undefined;
}

/** Turns the typed `q` into the three prefixes the repository matches (name, phone, custom field value). */
export function buildContactSearch(term: string): ContactSearch {
  const phonePrefix = phonePrefixOf(term.trim());
  return {
    namePrefix: foldName(term),
    valuePrefix: term.trim().toLowerCase(),
    ...(phonePrefix === undefined ? {} : { phonePrefix }),
  };
}
