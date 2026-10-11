# @banijjik/admin

Next.js (App Router) admin app. Cards 0.5b and 1.7a: the persistent tenant shell under `/{orgSlug}`, sign-in and sign-up, silent session renewal, route protection, the business list and the account menu (business switcher, language, sign out). Card 1.7c adds the menu from `/me/config`, the subscription banners, the home page, staff management (list, detail, assignments, suspend, reactivate, remove), invitations and the invitation accept page. Card 1.7d adds the business profile (with its Locations section), the locations list with add, edit and archive, and the roles list and detail with the custom-role form; the role form reads which permissions are sensitive from `permissionDefinitions` in `/me/config`, never from a list in the app.

## Run

```
cp apps/admin/.env.example apps/admin/.env.local   # then edit; never commit it
npm run dev -w @banijjik/admin                      # http://localhost:3000
```

The API (`apps/api`) must run too. In development both apps are on `localhost`, so the browser shares the session cookies between ports; in production they share a parent domain (`COOKIE_DOMAIN` on the API). `/` shows the signed-in person's businesses (or goes straight into the only one) and `/sign-in`, `/sign-up` are the public pages.

## How the session works

- The API sets two httpOnly cookies: `access_token` (`Path=/`, 15 minutes) and `refresh_token` (`Path=/api/v1/auth`, 30 days). No token is ever kept in web storage.
- Server components call the API with `serverApiFetch` (`src/lib/api`): it forwards only the `access_token` cookie and never caches. `requireSession` (`src/auth/session-data.ts`) turns a 401 into `redirect("/session?next=…")`; the proxy (`proxy.ts`) hands the requested path to server components in the `x-request-path` header.
- `/session` is a small client page: it calls `POST /auth/refresh` (the only place the refresh cookie is sent) and returns to `next`, or goes to `/sign-in?next=…` when the renewal fails.
- Browser calls use `apiFetch`: one 401 on a non-auth path triggers one shared refresh (parallel calls refresh once) and one retry; a second 401 redirects to sign-in.
- `next` is read only through `safeNextPath` (`src/auth/safe-next-path.ts`): a single-slash same-origin path or `/`.
- Switching business is a full page load (plain `<a>`, ADR-022). Navigation inside a business never remounts the shell.
- Creating a business in the UI is not built yet (cards 2.1 and 6.1); a person with no business sees an empty state.

## Layout of the code

- `app/layout.tsx`: root layout, fonts (Inter + Noto Sans Bengali through `next/font`, self-hosted at build time), providers.
- `app/(auth)`: sign-in and sign-up pages. `app/session`: the renewal page. `app/page.tsx`: the business list.
- `app/[orgSlug]/(app)/layout.tsx`: server layout; loads `/me` and `/me/orgs` and renders `OrganizationShell` (an unknown slug is a 404, a suspended business shows its explanation). Never turn off server rendering for it (ADR-010).
- `src/config/env.ts`: the only reader of `process.env` for validated values (Zod; server side). `src/config/api-base-url.ts` reads the one value the browser needs without Zod, so the schema library stays out of the first page load.
- `src/lib/api`: `apiFetch` (browser: cookies, renewal, `Idempotency-Key`, envelope parsing), `serverApiFetch`, `ApiError` (`code` is a contracts `ErrorCode`; `retryAfterSeconds` from a 429), `auth-api`, `me-api`.
- `src/auth`: the forms (`SignInForm`, `SignUpForm`, built on the ui Form primitives, validated with the same Zod schemas as the API, API field errors mapped by path in `map-api-error.ts`), `safeNextPath`, `signOut`, `SessionRenewal`.
- `src/lib/i18n`: `getLocale`/`getTranslator` for server components (cookie `locale`, Bangla default), `I18nProvider`/`useTranslator` for client components, `setLocaleAction` (server action: cookie, then `PATCH /me`).
- `src/shell`: `OrganizationShell`, `AccountMenuContainer` (trigger plus the lazily loaded sheet), `ShellNavigation`, `ShellLink`, `LanguageSwitch`.
- `src/orgs`: the business list (`BusinessHome`, `BusinessList`).
- `src/shell/org-access.ts`: one cached load per request of `/me`, `/me/orgs`, `/me/config` and the profile (time zone); the layout and the pages share it. `menu-groups.ts` builds the sidebar and bottom-nav groups, `banner-state.ts` decides the banners, `permissions.ts` reads the caller's grants.
- `src/staff`: the staff screens (list, detail), the assignments form and the member actions. `src/invitations`: the invitation list, the form with the one-time link, and the accept page.
- Text: screen text that only server components render lives in `SCREEN_CATALOGS` (`packages/i18n`), not in the bundled catalogs, so it stays out of the browser bundle. Server pages translate it and pass it to client components as props (`*-labels.ts`).
- Sheets, dialogs and forms load on first use through `useLazyComponent` (`src/lib`), so they are not part of the first load of a route.

## Rules

- Pages use `@banijjik/ui` components and tokens only: no hex colours, no px font sizes, no literal user-facing text (use i18n keys).
- Imports inside this app have no `.js` extension (Next bundles with the Bundler resolver; the workspace packages use NodeNext).
- Server components call `getTranslator()`; client components get text as props or use `useTranslator()`.
- Do not import `src/config/env.ts` or a Zod schema from code the first page load needs (initial JS budget 170 KB gzip, 13-UX section 11).

## Lighthouse

`npm run lighthouse -w @banijjik/admin` builds nothing: run `npm run build -w @banijjik/admin` first (with the two env variables set). It starts `next start` on port 3100 and audits `/sign-in` three times with Lighthouse's default mobile emulation, asserting performance and accessibility at 0.9 or more. Since card 1.7a the shell pages need a signed-in person, so the audit uses the public sign-in page. Not in CI.

## Browser tests

`npm run test:browser -w @banijjik/admin` runs real-browser checks against the real stack, nothing mocked: an in-memory MongoDB replica set, the built API (`apps/api/dist`) on port 4000, the built admin app (`next start`) on port 3101 and headless Chrome (puppeteer-core, no browser download).

Before running: build the API and the admin app (`NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_BRAND_NAME=Example npm run build -w @banijjik/admin`), start the compose Redis (`redis://127.0.0.1:6380`), and set `CHROME_PATH` to a Chrome executable. Without internet, also set `MONGOMS_SYSTEM_BINARY` to a local `mongod` and `MONGOMS_VERSION_CHECK=false`.

- `src/auth/auth-flow.browser.test.ts`: sign up, sign out, wrong password, `next` safety, redirect to sign-in and back, silent renewal of an expired access cookie, the shell with real data, a full reload when switching business, language switch.
- `src/staff/staff-invitations.browser.test.ts`: invite, sign up as the invitee, accept, suspend and reactivate; the route size budgets; screenshots when `SCREENSHOT_DIR` is set.
- `src/shell/sheet-stacking.browser.test.ts`: the Quick create and More sheets are on top at 375 px (review J3).
- `src/auth/screenshots.browser.test.ts`: only runs when `SCREENSHOT_DIR` is set; saves the 375 px and 1280 px screenshots of the handoff.

The files run one after another because each starts the whole stack on the same ports. They are not part of `npm test`.
