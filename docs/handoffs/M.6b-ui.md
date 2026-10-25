# Handoff: card M.6 part b (storefront app, public pages) · IMPLEMENT · 2026-10-25

- **Branch:** `s/M.6b-ui-storefront`, created from `origin/main` (`f9311d89`, M.6a merged), rebased on the latest main before the push. Pushed without force.
- **Model:** Claude Haiku 5.5 (Claude Code), unattended run.
- **Plan:** `docs/plans/M.6.md`, Part M.6b only (decisions 8 to 14, the M.6b rows of Files, the M.6b test list, the noindex note). The plan has no Refresh or Amendment section, so the base text was followed.
- **CI:** green, https://github.com/abdullahboshir/banijjik/actions/runs/40161032003

## Done

**App `apps/storefront`** (`@banijjik/storefront`, new workspace; copied config from `apps/admin`: Next 16.4.2, React 19.3, tsconfig, postcss, `next.config.ts`, the two fonts and the browser test harness pattern). Pages: home (name or About title, link to search, statistics), search (filters, results, pager), listing page, sign-in (phone, then code), static pages (`/pages/<key in lower case>`), language switch (`/language?to=bn|en`), not-found and error pages, `robots.txt` and `sitemap.xml` per host.

**Host and proxy (decisions 9 and 10)**
- `proxy.ts` (Next 16 name for the middleware file; the admin app uses it too) resolves the Host with `GET /api/v1/storefront/resolve` through `src/host/host-resolver.ts`: an in-memory cache of 60 s for hits and misses, a failed lookup is not cached. It sets `x-storefront-organization-id`, removing any value the client sent.
- `app/api/v1/storefront/[...path]/route.ts` and `app/api/v1/public/files/[...path]/route.ts` forward to the API through `src/proxy/proxy-request.ts`: a foreign-Origin write is refused 403 (`origin-guard.ts`), a path naming another business or with a dot segment is refused 404 before it is sent (`path-guard.ts`), only the cookie, `Idempotency-Key`, content type and accept headers are forwarded (no Origin, no Host), every `Set-Cookie` comes back (`forward-headers.ts`). Upstream timeout 15 s, failure 502.
- Server reads (`src/api/storefront-api.ts`) forward the `sf_access` cookie only; public reads use the Next data cache for 60 s.

**Theme (decision 11):** the root layout writes the brand colours into `--color-brand-primary` (and `--color-brand-accent`) from the `/site` read, only for six-digit hex codes (`src/site/theme.ts`).

**Markdown (decision 12):** `markdown-it` `14.3.3` with `@types/markdown-it` `14.1.2`. `html: false` (raw HTML is shown as text), link validation to `http`, `https` and `mailto` only, `rel="nofollow noopener noreferrer"` on links (`src/markdown/render-markdown.ts`).

**Search:** filters for SELECT, MULTI_SELECT, NUMBER (min and max) and DATE (age range) fields that the template marks filterable, as a plain GET form (`src/search/search-query.ts`, `src/components/search-filters.tsx`).

**i18n:** the storefront text is a new small catalog `STOREFRONT_CATALOGS` in `packages/i18n` (`src/catalogs/storefront/{bn,en}.json`, export line added to `index.ts`). It is not in the screen catalogs (150 KB), which would have broken the budget for client components.

**Lint scope (add-only):** `eslint.config.mjs` (next rules and core-web-vitals files, Next root dirs) and `eslint/restrictions.mjs` (JSX text rule) list `apps/storefront`. CI: one step `Storefront browser suite` after the platform suite in the `browser` job.

## Deviations from the plan (and why)

1. **`middleware.ts` is `proxy.ts`**: Next 16 renames the file; the admin app uses `proxy.ts` too.
2. **Session refresh is not in the proxy.** The plan says the proxy refreshes an expired access token, then the page retries. The refresh cookie has path `/api/v1/storefront` (ADR-119, `customer-cookies.ts`), so a page request never carries it. Instead the layout renders `SessionRenewer` (client) when the visitor is not signed in: it calls `POST /api/v1/storefront/orgs/{id}/auth/refresh` once through the proxy, and on success refreshes the page.
3. **Sign-out is a client call** to `/auth/logout` through the proxy, for the same reason (the refresh cookie must reach the API).
4. **Filter types.** Plan: "filters built from fields where isFilterable". Built: SELECT, MULTI_SELECT, NUMBER, DATE. TEXT, GEO_BD and BOOLEAN filters are not in the form (see gaps).
5. **Listing actions.** Plan: "unlock" and "report" buttons. Built: when signed out, one sign-in call to action (`/sign-in?next=/listings/<n>`). The unlock and report buttons are M.6c; a signed-in visitor sees no action on the listing page yet.
6. **Accent colour** is written to `--color-brand-accent`, a storefront alias of the primary token in `globals.css` (the ui tokens have no accent).
7. **Folder `src/static-pages`** (not `src/pages`): Next treats `src/pages` as the Pages Router when the app uses `src/`.
8. **Sign-in success** reloads the page at `next` (validated by `safeNextPath`); the header then shows the name, or the phone when the customer has no name (`name` is null until M.6c sets it).
9. **`apps/storefront/AGENTS.md`** is the generated Next file, copied from `apps/admin` (same content).
10. **markdown-it 14.3.3, not 14.3.2.** The first CI run failed `npm audit --omit=dev --audit-level=high` on markdown-it 14.3.2 (GHSA-vfgh-jcmw-g37q, GHSA-gfr2-rv44-r23c, both high). 14.3.3 is the patched release; the lock was updated with `npm install --package-lock-only` (no node_modules change). The local node_modules still holds 14.3.2 on this PC, so the Markdown unit test ran against 14.3.2 locally; CI runs it against 14.3.3.
11. **`eslint.config.mjs` and `eslint/restrictions.mjs`** are add-only edits outside the plan's Files list (the lint rules need the new app listed, see "Lint scope").

## Test names

Unit (`npm test -w @banijjik/storefront`, 10 files, 20 tests passed locally):
- `src/host/host-resolver.test.ts`: `resolves a host once per minute and caches a miss`; `does not cache a failed lookup, so the next request asks the API again`
- `src/proxy/origin-guard.test.ts`: `refuses a write whose Origin is another host`; `allows a write from the storefront's own host, and any read`
- `src/proxy/path-guard.test.ts`: `refuses a proxied path that names another organization`; `refuses dot segments and paths outside the storefront API`; `allows only the host lookup as the bare resolve path`; `allows public file paths without dot segments`
- `src/proxy/forward-headers.test.ts`: `passes every Set-Cookie back`; `sends no browser Origin or Host to the API`
- `src/markdown/render-markdown.test.ts`: `drops raw HTML and keeps safe links only`
- `src/host/organization-header.test.ts`, `src/site/theme.test.ts`, `src/static-pages/page-routes.test.ts`, `src/search/search-query.test.ts`, `src/search/field-value.test.ts`: behaviour specs of the helpers (client or server values, colours, slugs, query string, option labels)

Browser (`npm run test:browser -w @banijjik/storefront`, `src/storefront.browser.test.ts`, real API and worker, `shop.sites.localhost:3102`):
- `shows the home page with the logo, the colours and the statistics`
- `filters the search results and shows the empty state when nothing matches`
- `shows a listing page with its details and a sign-in call to action when signed out`
- `signs a customer in with the test-inbox code, sets the cookies and shows the account in the header`
- `shows a published static page`
- `answers an unknown host with 404 and the site-not-found text`
- `keeps the initial JavaScript of each route within the budget` (170 KiB gzip, measured from the scripts of the HTML)
- `has no sideways scroll on a phone` (390 px wide)

Local checks: `tsc --noEmit` passes for the storefront (including the browser tests); `eslint` on `apps/storefront` and the i18n catalog file passes with `--max-warnings 0`; `prettier --check` passes; `next build` passes (routes `/`, `/search`, `/listings/[listingNumber]`, `/pages/[pageKey]`, `/sign-in`, `/language`, the two proxy routes, `robots.txt`, `sitemap.xml`). The browser suite needs MongoDB, Redis on 6380 and Chrome, which do not fit this PC's RAM; it runs in CI only.

## Route sizes

Measured in the CI browser suite (https://github.com/abdullahboshir/banijjik/actions/runs/40161032003), KiB gzip, budget 170: `/` 149.0, `/search` 149.0, `/listings/<n>` 149.0, `/sign-in` 150.6.

The first CI run showed 187.7 because the test also counted the `nomodule` legacy polyfill (38.7 KiB), which modern browsers never download. The test now skips `nomodule` scripts, exactly as the admin suite does (`apps/admin/src/test-support/initial-js-size.ts`). The budget stays 170; no page code changed.

## Lead's browser-suite fixes (before this session)

Reserved slug for the seeded business, matrimony template published before seeding, directory grant, OTP wait with `sentAfter`, GEO_BD sample value, lower-case colour.

## Known gaps

- Search filters for TEXT, GEO_BD and BOOLEAN fields are not built (plan asks for filters "where isFilterable"; the form covers the four types above).
- Listing page: unlock and report buttons (M.6c). Signed-in visitors see no action there yet.
- Listing photos are not shown (`photoPolicy` NONE by default, out of scope in the plan).
- Customer name: the header shows the phone when the customer has no name (no name field until M.6c).
- IP-based limits: the proxy does not forward `x-forwarded-for` (a browser could forge it), so the API sees the storefront server's address for every customer. Rate limits by IP then count the whole storefront together until the deployment passes a trusted client address (card 6.x). Write this in STATUS.
- The noindex rule: every listing page carries `robots: noindex` (plan risk note).
- Session renewal is one call per visitor page load while signed out (a 401 for anonymous visitors). Cheap, but it is an extra request on every first page view.
- `NEXT_PUBLIC_BRAND_NAME` is read at request time on the server (`src/config/environment.ts`); the storefront has no `NEXT_PUBLIC` value in the browser.
