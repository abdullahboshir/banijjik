# @banijjik/ui

Design tokens, the foundation components of `docs/13-UX.md` section 9, and the only money, number and phone formatting functions.

## Rules

- Components are presentational and text-agnostic. This package never imports `@banijjik/i18n`: every visible string, including accessible names (`navLabel`, `closeLabel`), is a prop that the app has already translated.
- Responsiveness is CSS only (no breakpoint checks in JS, no `window` access at module level), so server and client render the same tree.
- Components use semantic tokens only. No hex colours and no px font sizes in `src/components` (checked by grep in the card handoff).
- Only named exports from `src/index.ts`. Files that hold state, context or Radix primitives start with `"use client"`.
- Pages never format money or phones by hand: use `MoneyText`, `formatMoney`, `formatNumber`, `formatPhoneForDisplay`.

## Links

Shell components (`Sidebar`, `BottomNav`, `QuickCreateSheet`) render links through `useLinkComponent()`. The default is a plain `<a>`. An app wraps its root once so navigation stays client-side:

```tsx
// Next's Link does not typecheck under exactOptionalPropertyTypes; wrap it once (see ShellLink in apps/admin).
import { ShellLink } from "./shell-link";
<LinkComponentProvider component={ShellLink}>{children}</LinkComponentProvider>;
```

Any component that renders an `href` must use `useLinkComponent()`, never a bare `<a>`. The component receives `href`, `className`, `children`, `aria-current` and `onClick`.

## Tokens

`src/tokens/*.ts` are the source of truth. `scripts/build-tokens.mjs` (run by `npm run build` after `tsc`) writes `src/styles/tokens.css`; the file is committed and a test fails if it drifts from the generator.

- Colours: `--color-<group>-<name>` on `:root` (light) and `[data-theme="dark"]` (dark, not applied at launch).
- Everything else: `--token-<scale>-<name>`.
- `src/styles/theme.css` maps them to Tailwind v4 utilities with `@theme inline`: `bg-app`, `bg-surface`, `bg-subtle`, `border-default`, `text-primary`, `text-secondary`, `text-muted`, `bg-brand`, `text-on-brand`, `text-success|warning|danger|info|neutral`, `text-display|display-lg|title|body|small|caption`, `z-sticky|nav|sheet|dialog|toast`.

An app imports `tailwindcss`, then `@banijjik/ui/styles.css`, and adds an `@source` line for this package's sources.

Changing the brand colour means editing three tokens in `src/tokens/color.ts` and running `npm run build -w @banijjik/ui`. The contrast test checks every text pair in both themes.

## Adding a component

Add a file in `src/components`, a test with Bangla text longer than the English equivalent, and a named export in `src/index.ts`. Keep icons in `src/lib/icons.tsx` (lucide only).

## Toast subpath

`@banijjik/ui/toast` exports `toast`, `Toaster` and `UNDO_DURATION_MS` on their own so an app can load sonner lazily (admin mounts the Toaster after first paint). A `toast()` call before the Toaster has mounted is safe but is not shown.

## Account menu

`AccountMenu` is the sheet behind the top bar's account button: the person's name, their businesses, the language switch and sign out. `AccountMenuTrigger` is the small button that opens it. Text and items arrive as props (the package stays text-agnostic), and apps load `AccountMenu` lazily like the other sheets. The business links are plain `<a>` elements on purpose, not `useLinkComponent()`: switching business is a full page load (ADR-022), so a client-side navigation would be wrong here.
