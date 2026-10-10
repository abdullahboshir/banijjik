# @banijjik/admin

Next.js (App Router) admin app. Card 0.5b builds only the persistent tenant shell under `/{orgSlug}`; login, org switching and menu data arrive in card 1.7.

## Run

```
cp apps/admin/.env.example apps/admin/.env.local   # then edit; never commit it
npm run dev -w @banijjik/admin                      # http://localhost:3000/<orgSlug>
```

`/` is a 404 until card 1.7 adds the login page.

## Layout of the code

- `app/layout.tsx`: root layout, fonts (Inter + Noto Sans Bengali through `next/font`, self-hosted at build time), providers.
- `app/[orgSlug]/(app)/layout.tsx`: server component that renders the shell (`AppShell`, `TopBar`, `Sidebar`, bottom navigation). It is the layout, so navigating inside an org never remounts it. Never turn off server rendering for it (ADR-010).
- `src/config/env.ts`: the only reader of `process.env`; validates `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_BRAND_NAME` with Zod.
- `src/lib/api`: `apiFetch` (cookies, `Idempotency-Key`, envelope parsing; a 2xx without `data` is an `errors.invalid_response` error, 204 resolves to `{ data: undefined }`) and `ApiError` (`code` is a contracts `ErrorCode`; an unknown wire code becomes `INTERNAL`).
- `src/lib/i18n`: `getLocale`/`getTranslator` for server components (cookie `locale`, Bangla default), `I18nProvider`/`useTranslator` for client components.
- `src/shell`: `buildBottomNavSlots` (pure), `ShellNavigation` (bottom nav and its two sheets), `ShellLink` (Next `Link` adapted to the ui link contract).

## Rules

- Pages use `@banijjik/ui` components and tokens only: no hex colours, no px font sizes, no literal user-facing text (use i18n keys).
- Imports inside this app have no `.js` extension (Next bundles with the Bundler resolver; the workspace packages use NodeNext).
- Server components call `getTranslator()`; client components get text as props or use `useTranslator()`.

## Lighthouse

`npm run lighthouse -w @banijjik/admin` builds nothing: run `npm run build -w @banijjik/admin` first (with the two env variables set). It starts `next start` on port 3100 and audits `/test-org` three times with Lighthouse's default mobile emulation, asserting performance and accessibility at 0.9 or more. It needs Chrome (set `CHROME_PATH` if it is not found). Not in CI yet.

## Browser test (sheet stacking)

`npm run test:browser -w @banijjik/admin` opens `/test-org` at 375 px in headless Chrome (puppeteer-core, no browser download), opens the Quick create and More sheets and checks with `document.elementFromPoint` that the sheet, not its overlay, is on top at its centre and at its close button (review J3). Build first with the two env variables set, and set `CHROME_PATH` to a Chrome executable. It starts `next start` on port 3101. It is not part of `npm test`.
