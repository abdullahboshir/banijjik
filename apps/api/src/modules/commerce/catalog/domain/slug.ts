import { OFFERING_SLUG_MAX_LENGTH } from "@banijjik/contracts/catalog";

const NON_LATIN_RUNS = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
const ID_SUFFIX_LENGTH = 8;

/**
 * A URL slug from a name: Latin letters and digits, kebab-cased. A name without any Latin letter
 * or digit (a Bangla name) gets `<prefix>-<last 8 characters of the id>`, which is unique enough
 * to be a start and never empty.
 */
export function slugFromName(name: string, fallback: { prefix: string; recordId: string }): string {
  const kebab = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(NON_LATIN_RUNS, "-")
    .replace(EDGE_DASHES, "")
    .slice(0, OFFERING_SLUG_MAX_LENGTH)
    .replace(EDGE_DASHES, "");
  if (kebab !== "") return kebab;
  return `${fallback.prefix}-${fallback.recordId.slice(-ID_SUFFIX_LENGTH)}`;
}

/** The first of `base`, `base-2`, `base-3`, ... that is not taken; the unique index stays the final net. */
export function firstFreeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let number = 2; ; number += 1) {
    const suffix = `-${number}`;
    const candidate = `${base.slice(0, OFFERING_SLUG_MAX_LENGTH - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
