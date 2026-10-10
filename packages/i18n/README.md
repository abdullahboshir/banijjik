# @banijjik/i18n

Bangla and English message catalogs and a pure-TypeScript translator. No React dependency: the app wraps `createTranslator` in its own provider (card 0.5b).

## Use

```ts
import { createTranslator, DEFAULT_LOCALE } from "@banijjik/i18n";

const { t } = createTranslator({
  locale: DEFAULT_LOCALE,
  brandName: brandingConfig.name, // never a literal (ADR-038)
  terms: resolvedConfig.terms, // { "term.contact.plural": "ছাত্র" }
  onMissingKey: (key) => reportMissingKey(key),
});

t("errors.not_found");
t("state.empty.contact"); // "এখনো কোনো ছাত্র নেই" when the term is overridden
```

## Rules

- Catalogs are flat dotted keys in `src/catalogs/{bn,en}.json`. Both files must have the same keys and the same placeholders (tested).
- `{name}` is filled from the values passed to `t`. `{brand}` comes from `brandName`. `{term:contact.plural}` resolves from `terms` first, then the catalog's own `term.contact.plural`.
- `src/catalogs/screens/{bn,en}.json` (`SCREEN_CATALOGS`) hold text that only server components render. They are not part of `BUNDLED_CATALOGS`, so they stay out of the browser bundle; server code passes them to `createTranslator` through `catalogs`, and client components receive such text as props. The same key and placeholder rules apply.
- Catalogs never contain the brand name.
- A missing key returns the key itself and calls `onMissingKey`.
- Every API error code has `errors.<code lowercased>` (`docs/14-API.md` section 3), and Zod issue codes have `validation.*` keys.
- `DEFAULT_LOCALE` is `bn` (ADR-055).
