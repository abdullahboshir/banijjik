# @banijjik/platform

Next.js (App Router) panel for the people who run the platform (card 1.8b, ADR-060). Desktop first, with its own accent colour so nobody mistakes it for a tenant's dashboard. It runs entirely on the platform API of card 1.8a (`/api/v1/platform`).

Operators can sign in, find a tenant, suspend or reactivate it, extend a trial, change a subscription's package, grant or revoke a module, list/create/edit/archive packages, and read the platform audit log.

## Run

```
cp apps/platform/.env.example apps/platform/.env.local   # then edit; never commit it
npm run dev -w @banijjik/platform                          # http://localhost:3200
```

The API (`apps/api`) must run too, and the first operator must exist: set `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD` for the API and run `npm run seed:platform-admin -w @banijjik/api`. In development this app and the admin app are on `localhost`, so the browser shares cookies between ports; the two audiences never clash because their cookie names differ (`platform_access_token` / `platform_refresh_token` against `access_token` / `refresh_token`) and so does the loop-guard marker (`platform_session_renewed`).

## How it works

- **Session:** the same flow as the admin app, configured for the operator audience in `src/api/platform-api-client.ts` and `platform-server-api.ts` on top of `@banijjik/web-client`. Sign-in posts to `/platform/auth/login`, renewal to `/platform/auth/refresh`. A business account is refused at sign-in with the same message as a wrong password.
- **Permissions:** the panel layout calls `GET /platform/me` on every request (`loadOperator`, once per request). The permission keys it returns decide which menu entries and action buttons are drawn (`src/shell/navigation-entries.ts`, `src/tenants/tenant-action-labels.ts`). No role is named in the UI; the API enforces every permission again (ADR-093 maps roles to permissions and may change without a UI change).
- **Routes** (`app/(panel)`): `/tenants`, `/tenants/{organizationId}`, `/packages`, `/packages/new`, `/packages/{packageId}`, `/audit`. `/` goes to the first page the operator may open.
- **Writes** go from the browser through `apiFetch` (`src/api/platform-api.ts`); after each one the page reloads its server data (`router.refresh()`) and a toast confirms. Sheets and dialogs (`src/tenants`, `src/packages`) load on the first tap, so they stay out of the first load of a route (budget 170 KiB gzip, 13-UX section 11).
- **Accent:** `app/globals.css` overrides the three brand tokens only; the values are `platformAccentTokens` of `@banijjik/ui`, whose contrast test runs there, and `src/shell/accent.test.ts` keeps the CSS and the constant in step.
- **Text:** all from i18n keys. Platform screen text is `PLATFORM_SCREEN_CATALOGS` (`packages/i18n`, bn and en with identical keys), which only server components read; client components receive what they need as props (`pickLabels`, `*-labels.ts`). `src/i18n/catalog-coverage.test.ts` fails when a key used in the code has no text.
- **Module classes:** the module checkboxes and the grantable-module list use `MODULE_CLASS_BY_KEY` from contracts (there is no endpoint that lists modules, and a module that is not built has no manifest).

## Rules

- Pages use `@banijjik/ui` components and tokens only; no web storage; no `ssr:false`; no literal user-facing text.
- Imports inside this app have no `.js` extension (Next's Bundler resolver); workspace packages use NodeNext.
- Do not import a Zod schema from code the first page load needs: the forms load `@banijjik/validation` inside their submit handlers or in lazily loaded sheets.

## Browser tests

`npm run test:browser -w @banijjik/platform` runs `src/panel.browser.test.ts` against the real stack, nothing mocked: an in-memory MongoDB replica set, the built API on port 4000, the platform super admin created with the real seed script, the built admin app on port 3102 (a tenant's member signs in there), the built platform app on port 3201 and headless Chrome. It covers operator sign-in (and the refusal of a business user), finding a tenant, suspend and reactivate (the member sees the suspended page, then the business), granting a module (the member's `/me/config` lists it), extending the trial, creating and archiving a package, the audit log, and the initial JS size of every route. With `SCREENSHOT_DIR` set it also saves the 1280 px and 375 px pictures.

Before running: build the API, the admin app and this app with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_BRAND_NAME=Example`, and set `CHROME_PATH`. Without internet also set `MONGOMS_SYSTEM_BINARY` and `MONGOMS_VERSION_CHECK=false`. The fixed ports 4000, 3102 and 3201 must be free: the test waits for them (up to ten minutes) instead of talking to a server it did not start.

**The API of this stack is `src/test-support/probe-api.mjs`, not `dist/main.js`.** It starts the built API the way `main.ts` does, plus one probe module (`bookkeeping`, OPTIONAL, no routes). The production registry has no optional module yet, so without a probe an operator could grant nothing. Drop the probe when the first real optional module exists.

This test has its own stack helper (`src/test-support/browser-stack.ts`); sharing the admin helper was not mechanical (it is fixed to one app, one port and `process.cwd()`).
