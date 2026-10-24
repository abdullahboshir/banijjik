# Plan: card M.6 · Minimal storefront for directories

Tier: M.6a T1 (API) · M.6b T2 (storefront app, public pages) · M.6c T2 (signed-in pages, admin page editor) · Planned by: Opus 5.5 · Date: 2026-10-24 · Based on commit: `91aa3d94`

## Session parts
| Part | Branch | Content | Starts |
|---|---|---|---|
| **M.6a** API (T1) | `s/M.6a-api-storefront-reads` | decisions 1–7: `website` module with static pages (admin CRUD + storefront read), `GET /site`, `GET /directory/form`, `GET /directory/stats` with its summary, template data | now |
| **M.6b** app (T2) | `s/M.6b-ui-storefront` | decisions 8–14: new `apps/storefront`, host resolution, same-origin proxy, theme, home, search, listing page, sign-in, static pages, CI job | after M.6a merges |
| **M.6c** screens (T2) | `s/M.6c-ui-storefront-account` | decisions 15–17: my biodata (multi-step), my connections, credits (balance, buy, history), my account (export, erase), report and block buttons; admin static page editor | after M.6b merges |

The roadmap row says "split a and b"; the app is too large for one part, so the signed-in pages and the admin editor are part c.

## Goal
After this card a business with the `directory` module has a public, server-rendered website on `<slug>.<STOREFRONT_BASE_DOMAIN>`: its own name, logo and colours, a home page with listing statistics, search with the template's filters, listing pages, phone sign-in, a customer's own biodata form, connections, credits and static pages written in the admin. Every page calls only the storefront API that already exists, plus four new reads. The same app grows into the general website of cards 4.x.

## Inputs read
- `docs/16-MATRIMONY-TRACK.md` §3.1–§3.5, §5; `docs/14-API.md` §6; `docs/13-UX.md` §2 (app table), tokens section, ADR-057; `docs/06 §8` (website CMS, ADR-029).
- ADR-010 (httpOnly cookies, server-rendered shells), ADR-031 (shared hosting, subdomain first), ADR-077 (API surfaces), **ADR-119** (customer accounts: host-only `sf_access` / `sf_refresh`, the storefront calls the API through its own origin, the proxy must not pass a browser `Origin` the API does not allow), ADR-127/129/130/134 (directory).
- Code: `apps/api/src/routes/storefront.ts` (pipeline, `slugOfHost`, `businessContext`, `customerLoginSwitch`), `contact/presentation/customer-cookies.ts` (refresh cookie path `/api/v1/storefront`), `app.ts` (CORS and `createOriginCheck`), `routes/directory-storefront-adapters.ts` (`listingFieldsFromEffectiveReader`, `buildDirectoryBlockReader`), `directory/presentation/directory-storefront.router.ts`, `contracts/src/directory/directory-contracts.ts` (`DirectoryConfigResponse`), `contracts/src/custom-field/custom-field-contracts.ts` (`EffectiveCustomField`), `contracts/src/platform/industry-template.ts` (`IndustryTemplateDirectoryBlock`), `contracts/src/file/file-contracts.ts` (`PUBLIC_FILE_PATH_PREFIX = /api/v1/public/files`, LOGO is PUBLIC, LISTING_PHOTO is PRIVATE), `organization/index.ts` (`buildStorefrontOrganizationReader`), organization branding fields (`logoFileId`, `primaryColor`, `accentColor`, `tagline`, card 3.12), `MODULE_KEY.WEBSITE` (exists, OPTIONAL, no module folder yet), industry seeds `matrimony.json`, `matrimony-islamic.json`.

## Decisions

### M.6a · API
1. **Static pages are the first slice of the `website` module.** New module `apps/api/src/modules/commerce/website` (key `MODULE_KEY.WEBSITE`, already OPTIONAL) with a `module.manifest.ts`. Entity `SitePage`: `sitePageId`, `organizationId`, `pageKey` (contract enum `SITE_PAGE_KEY`: `ABOUT`, `FAQ`, `GUIDE`, `TERMS`, `PRIVACY`, `REFUND`), `title: { bn, en }`, `body: { bn, en }` (Markdown text), `isPublished`, `version`, audit fields. One row per `(organizationId, pageKey)` (unique index). Tenancy ORGANIZATION. Cards 4.x add section pages to the same module and the same `GET /pages/{pageSlug}` read (14-API §6); a MARKDOWN page stays one kind of page. Record it in ADR-144.
   - Admin: `GET /orgs/:organizationId/website/pages` (all six keys; a missing row is returned as an empty unpublished page with `version: 0`), `PUT /orgs/:organizationId/website/pages/:pageKey` (body `{ title, body, isPublished, version }`, upsert: `version: 0` creates, otherwise versioned update, stale → 409). Permissions `website.page.read` (owner, manager, staff) and `website.page.update` (owner, manager). Audit `website.page.updated`. Event `website.page.updated` (ids only).
   - Bounds (validation): title 1–120 characters per locale, body at most 20,000 characters per locale; at least one locale's title must be non-empty when `isPublished` is true. No HTML check in the API: the storefront renders Markdown without raw HTML (decision 12).
   - Storefront: `GET /storefront/orgs/:organizationId/pages/:pageKey` → published page only, else `404 errors.storefront_not_available`. Requires the `website` module to be effective (same switch pattern as `creditModuleSwitch`).
2. **`GET /storefront/orgs/:organizationId/site`** (public, `Cache-Control: public, max-age=60`): `{ organizationId, name, tagline: string | null, logoUrl: string | null (publicFilePath(logoFileId, "medium")), colors: { primary: string | null, accent: string | null }, features: { directory, credit, customerLogin, website: boolean }, pages: { pageKey, title }[] (published only, empty when `website` is off) }`. `customerLogin` is true only when `contact.customerLogin` is on and the SMS driver is not `disabled` (reuse the check of `customerLoginSwitch`, extracted to one function). The organization reader gains the branding fields; it stays a plain platform read (ADR-119). No other organization field is returned.
3. **`GET /storefront/orgs/:organizationId/directory/form`** (public, cache 60 s, `directory` module on): `{ sections, consents, fields: StorefrontListingField[], photoPolicy }`. `sections` and `consents` are the template block (same shapes as `DirectoryConfigResponse`); `fields` are the effective LISTING fields with `visibility.storefront: true`, projected to `fieldKey, label, fieldType, isRequired, options, optionLabels, validation, listingTier, isFilterable, sectionKey, minAgeYears, sortOrder`. Definitions are not personal data, so the read is public: the search page needs filter labels before sign-in. Rejection and report reasons are not in it (staff and report form have their own reads).
4. **Home statistics are pre-aggregated.** New optional template field `directory.homeStatsFieldKey` (a SELECT listing field with tier PUBLIC; template validation refuses any other field). Summary model `DirectoryListingStats` (one row per organization: `approvedCount`, `countsByOption: Record<string, number>`, `fieldKey | null`, `computedAt`, `version`, audit fields with null users). A directory event handler `directory.refreshListingStats` runs on `directory.listing.{approved,concealed,revealed,archived,updated}` and recomputes the row with one aggregation over the organization's APPROVED listings (index `{ organizationId, status }`, projection of the one field), written with an upsert. A handler rerun computes the same row (idempotent). Feature code never names the field: it reads `homeStatsFieldKey` from the template block.
5. **`GET /storefront/orgs/:organizationId/directory/stats`** (public, cache 60 s): `{ approvedCount, field: { fieldKey, label, options: { option, label, count }[] } | null }` from the summary row only (no scan). No row yet → zeros. Option labels come from the field definition, so a renamed option shows its new label.
6. **Template data:** both MATRIMONY seeds enable `website` and set `homeStatsFieldKey: "gender"`. Existing organizations get `website` through the normal template module list (no backfill script: no production data).
7. **Module off:** the generated module-off tests cover `website` (admin routes 404/403 as the other modules; storefront page read 404). `directory/form` and `directory/stats` answer 404 when `directory` is off.

### M.6b · Storefront app, public pages
8. **New app `apps/storefront`** (13-UX §2), Next.js App Router with the versions `apps/admin` uses, server-rendered, no `ssr:false` (ADR-010), mobile-first, **≤ 170 KiB initial JS per route** (doc 16 §3.4), BN and EN through `@banijjik/i18n` (new `storefront.*` keys) and `@banijjik/web-client` where it fits. Turbo, lint, typecheck and a CI browser job like `apps/admin`. No new UI library.
9. **Host → organization:** `middleware.ts` reads the `Host` header and calls `GET /api/v1/storefront/resolve?host=` server to server, caching the answer in memory for 60 s (positive and negative). The organization id travels to server components as a request header set by the middleware, never from the URL or the browser. Unknown host → a plain "site not found" page with status 404. Custom domains come with card 4.2.
10. **Same-origin proxy (ADR-119):** route handlers in the storefront app forward `/api/v1/storefront/*` (all methods) and `GET /api/v1/public/files/*` to `STOREFRONT_API_ORIGIN` keeping the path, the query, the body, the `Cookie` and `Idempotency-Key` headers, and passing back status, body and every `Set-Cookie`. The proxy sends **no** browser `Origin` to the API (server-to-server call). Instead the proxy itself refuses a non-GET request whose `Origin` is present and is not the request's own host (403): cookies are SameSite=Lax and this keeps cross-site form posts out. A request may only reach `/api/v1/storefront/orgs/<resolved organizationId>/…` or `/resolve`: a path naming another organization is refused (404) before it is forwarded.
11. **Theme from branding:** the root layout reads `GET /site` and writes the brand colours into CSS variables with the semantic token names of `packages/ui/tokens` (ADR-057); a missing colour falls back to the platform default. Logo from `logoUrl` through the proxy.
12. **Markdown** of static pages is rendered on the server with a renderer that drops raw HTML and allows only links with `http`, `https` and `mailto`. Choose a small maintained library and name it in the handoff; adding it is allowed by this card.
13. **Pages in M.6b:** home (logo, tagline, intro from the ABOUT page title, statistics from `/directory/stats`), search (`GET /listings`, filters built from `fields` where `isFilterable`, paged, query state in the URL), listing page (`GET /listings/:listingNumber`, sections from `/directory/form`, `noindex` meta when the template says so (see risks), "unlock" and "report" buttons that lead to sign-in when signed out), sign-in (phone → code, `POST /auth/otp/send` and `/verify`, a 404 from the API shows "sign-in is not open yet"), static pages, sign-out. A server component forwards the `sf_access` cookie to the API; an expired access token is refreshed once through `POST /auth/refresh` (via the proxy), then the page retries.
14. **SEO:** public pages carry titles and descriptions; signed-in pages and every listing page with `noindex` are excluded from the sitemap. A `robots.txt` per host.

### M.6c · Signed-in pages and admin editor
15. **My biodata:** a multi-step form with one step per template section, built from `fields` with the 2.5 field renderer used by the admin, save as draft (`PUT /my/listing`, versioned), submit with the consent checkboxes (`POST /my/listing/submit`), status and rejection reasons shown, archive with confirmation. No photo upload while `photoPolicy` is `NONE`; when it is not `NONE` the upload field is shown (the endpoint exists).
16. **My connections, credits, my account:** connections (`GET /my/unlocks`), credits (balance and entries, packs, payment info, submit a purchase with transfer reference and `Idempotency-Key`, own purchases with cancel), unlock with `Idempotency-Key` on the listing page, report form (`/listing-report-reasons`, `POST /listings/:listingNumber/reports`), block and unblock (`/my/listing-blocks`), data export and account erase (the M.7 A2 endpoints, erase with its own OTP step).
17. **Admin editor:** `apps/admin/src/website/pages` (route `website/pages`, a manifest menu entry under settings with `website.page.read`): the six pages, a Markdown text area per locale with a server-rendered preview using the same rules as decision 12, publish switch, versioned save. Route budget 180 KiB.

## Files
| Path | Create/Change | Owns / add-only | Part |
|---|---|---|---|
| `packages/contracts/src/website/**` | Create | owns | a: `SITE_PAGE_KEY`, permissions, audit action, event name, response types |
| `packages/contracts/src/directory/**`, `platform/industry-template.ts` | Change | add-only | a: `StorefrontListingField`, form and stats responses, `homeStatsFieldKey?` |
| `packages/contracts` index, permission and audit lists | Change | add-only | a (count tests change) |
| `packages/validation/src/website/**`, `validation/src/directory/**` | Create/Change | owns / add-only | a: page upsert body, template field rule |
| `apps/api/src/modules/commerce/website/**` | Create | owns | a: module, manifest, README, `SitePage`, repository, use cases, routers |
| `apps/api/src/modules/commerce/directory/**` | Change | owns | a: stats model, handler, form and stats reads |
| `apps/api/src/modules/core/organization/**` | Change | add-only | a: branding in the storefront organization reader |
| `apps/api/src/routes/storefront.ts`, `routes/tenant-module-routers.ts`, `routes/module-registry.ts` | Change | add-only | a: mount the new reads and the website routers |
| `apps/api/src/modules/platform/industry/infrastructure/seeds/matrimony*.json` | Change | owns | a |
| `docs/04-DECISIONS.md` (ADR-144), `docs/14-API.md` §6, `docs/16` §3.4 note | Change | add-only | a (b adds the proxy rules to ADR-144) |
| `apps/storefront/**`, root `package.json` workspaces, `turbo.json`, `.github/workflows/ci.yml` | Create/Change | owns / add-only | b |
| `packages/i18n` catalogs | Change | add-only | a (permission and page labels), b, c |
| `apps/admin/src/website/**`, `apps/admin/app/[orgSlug]/(app)/website/**` | Create | owns | c |

## Interfaces & types
```ts
// packages/contracts/src/website
export const SITE_PAGE_KEY = Object.freeze({
  ABOUT: "ABOUT", FAQ: "FAQ", GUIDE: "GUIDE", TERMS: "TERMS", PRIVACY: "PRIVACY", REFUND: "REFUND",
} as const);
export interface SitePageResponse {
  readonly pageKey: SitePageKey;
  readonly title: LocalizedText;
  readonly body: LocalizedText;
  readonly isPublished: boolean;
  readonly version: number; // 0 = not stored yet
  readonly updatedAt: string | null;
}
export interface SitePageUpsertRequest {
  readonly title: LocalizedText;
  readonly body: LocalizedText;
  readonly isPublished: boolean;
  readonly version: number;
}
export interface StorefrontSitePageResponse { readonly pageKey: SitePageKey; readonly title: LocalizedText; readonly body: LocalizedText; }

// storefront site
export interface StorefrontSiteResponse {
  readonly organizationId: string;
  readonly name: string;
  readonly tagline: string | null;
  readonly logoUrl: string | null;
  readonly colors: { readonly primary: string | null; readonly accent: string | null };
  readonly features: { readonly directory: boolean; readonly credit: boolean; readonly customerLogin: boolean; readonly website: boolean };
  readonly pages: readonly { readonly pageKey: SitePageKey; readonly title: LocalizedText }[];
}

// directory
export type StorefrontListingField = Pick<EffectiveCustomField,
  "fieldKey" | "label" | "fieldType" | "isRequired" | "options" | "optionLabels" | "validation"
  | "listingTier" | "isFilterable" | "sectionKey" | "minAgeYears" | "sortOrder">;
export interface StorefrontDirectoryFormResponse {
  readonly sections: DirectoryConfigResponse["sections"];
  readonly consents: DirectoryConfigResponse["consents"];
  readonly fields: readonly StorefrontListingField[];
  readonly photoPolicy: DirectoryPhotoPolicy;
}
export interface StorefrontDirectoryStatsResponse {
  readonly approvedCount: number;
  readonly field: {
    readonly fieldKey: string;
    readonly label: LocalizedText;
    readonly options: readonly { readonly option: string; readonly label: LocalizedText; readonly count: number }[];
  } | null;
}
// IndustryTemplateDirectoryBlock gains:
readonly homeStatsFieldKey?: string | undefined;
```

## Data
- `site_pages` (tenant DB, ORGANIZATION): fields above; unique `{ organizationId, pageKey }`; `version`, audit fields.
- `directory_listing_stats` (tenant DB, ORGANIZATION): unique `{ organizationId }`; written only by the handler.
- `listings`: the existing `{ organizationId, status, … }` index serves the aggregation; add `{ organizationId, status }` only if no existing index starts with it (check, write the result in the handoff).
- No migration.

## Tests (must exist and pass)
**M.6a**
- [ ] `stores a page, then answers it on the storefront once published` (PUT version 0 → 200; storefront GET 404 while unpublished, 200 after publish)
- [ ] `refuses a stale page version with 409 and changes nothing`
- [ ] `refuses a title over 120 characters and a body over 20,000 with 400`
- [ ] `refuses publishing a page with no title in either language`
- [ ] `lets a staff member read pages but not change them` (403 on PUT)
- [ ] `does not show one organization's page to another` (org A page, org B path → 404; admin cross-org 404/403 as other modules)
- [ ] `answers 404 for pages when the website module is off` (and the generated module-off tests)
- [ ] `the site read returns branding, features and published page titles only` (no other organization field in the body)
- [ ] `customerLogin is false while the SMS driver is disabled`
- [ ] `the form read returns only storefront-visible listing fields with their tiers and sections`
- [ ] `stats count approved listings by the template's field and ignore other statuses` (approve, hide, reveal, archive, update the field → counts follow)
- [ ] `stats read zeros before the first listing event and never scans listings` (a spy on the listing repository: no call)
- [ ] `a second delivery of the same listing event leaves the stats row unchanged`
- [ ] `template validation refuses a homeStatsFieldKey that is not a PUBLIC SELECT listing field`
- [ ] `form and stats answer 404 when the directory module is off`
- [ ] `packages/contracts` count tests updated (permission keys, audit actions, events)
- [ ] T1 §11 items 6 (page version), 15 (no `$regex`), 16, 17 (A: staff 403), 18 (n/a: ORGANIZATION tenancy, say so), 19–24, each named in the handoff

**M.6b**
- [ ] unit: `resolves a host once per minute and caches a miss`; `refuses a write whose Origin is another host`; `refuses a proxied path that names another organization`; `passes every Set-Cookie back`; `drops raw HTML from Markdown and keeps safe links only`
- [ ] browser (real API, `shop.sites.localhost`): home shows the logo, colours and statistics; search filters and pages; a listing page; sign-in with the test-inbox code sets the cookies and shows the account name; a static page; an unknown host is 404; initial JS ≤ 170 KiB per route; no sideways scroll on a phone
- [ ] CI runs the storefront browser job

**M.6c**
- [ ] browser: fill the biodata steps, save a draft, submit with consents, see SUBMITTED; staff approval (seeded through the API) then the listing appears in search; unlock with credits; buy a pack (PENDING purchase shown); report and block a listing; export downloads JSON; erase asks for the code
- [ ] admin unit and browser: edit and publish a page, the storefront shows it; a stale save shows the conflict message; staff sees the editor read-only
- [ ] budgets: storefront ≤ 170 KiB, admin route ≤ 180 KiB

## Out of scope
- Listing photo display (LISTING_PHOTO is PRIVATE; the default policy is `NONE`): a follow-up card when a business turns photos on.
- Section pages, themes, templates and the visual builder (cards 4.x), custom domains (4.2), offerings, cart and checkout on the storefront.
- SMS provider (M.9), notifications (M.8b), any change to existing storefront endpoints.
- Edge or CDN caching setup (Phase 6); the app sends `Cache-Control` only.

## Risks & checks
- **`noindex`:** doc 16 §3.4 says listing pages carry `noindex` "when the template says so", and the template block has no such field yet. M.6b adds nothing to the template: **every listing page carries `noindex`** until an owner decision adds a template switch (privacy first). Write it in the handoff.
- The proxy is security-critical: its tests (decision 10) are part of M.6b's merge check; the lead reviews `apps/storefront` proxy and middleware files as strictly as T1 code.
- Stats aggregation cost grows with approved listings; one aggregation per listing event is fine at pilot scale. If one business passes about 50,000 listings, move to counter updates: write it in the module README.
- The first new Next.js app since admin and platform: copy their config, budgets script and browser stack, do not invent a new structure.

## Amendment 1 (2026-10-25, lead, after the M.6b session's report)
1. **The proxy forwards the customer's address.** Without it the API sees every customer as the storefront server, so the per-address limits (OTP sends and verifies, search, detail) are shared by all customers and one abuser locks everyone out. The proxy sends `X-Forwarded-For` built from the incoming request as Next.js receives it (its own `x-forwarded-for`, which already ends with the peer address), and never adds a value of its own. The API already honours `TRUSTED_PROXY_HOPS` (`app.set("trust proxy", …)`): the deployment counts the storefront as one more hop. Write this in the handoff and in `docs/ops` (or the deployment notes the repo has) as a required setting. Unit test: `forwards the client address chain the storefront received`.
2. **Session refresh in the browser** (handoff deviation "SessionRenewer") is accepted: the refresh cookie's path is the API path, so a server component never sees it. Pages treat an expired access token as signed out until the renewer refreshes and reloads.
3. **Lint scope lines** in `eslint.config.mjs` and `eslint/restrictions.mjs` are accepted (add-only).

## Refresh M.6c (2026-10-25, lead, based on `main d633f44`)
**Start after M.6b merges** (it builds the storefront app, its proxy, layout, sign-in and the browser stack). Branch `s/M.6c-ui-storefront-account`, T2 (merge check). Decisions 15–17 stand; this section adds what the M.6a/M.6b work showed.

- C1 **Field renderer in the storefront.** The admin renderer (`apps/admin/src/contacts/…`) lives in another app and cannot be imported. Build a small renderer in `apps/storefront/src/fields/` for exactly the field types the form read returns (`TEXT`, `LONG_TEXT`, `NUMBER`, `DECIMAL`, `BOOLEAN`, `DATE`, `SELECT`, `MULTI_SELECT`, `PHONE`, `EMAIL`, `URL`, `GEO_BD`), using `@banijjik/ui` inputs and the shared value schema from `packages/validation/src/custom-field` for client checks (the API stays the authority). `GEO_BD` is two dependent selects (division, then district; upazila when the field asks for it) from `packages/contracts/src/directory/geo-bd-registry.ts`. Labels come from the field's `label.bn` / `label.en`; no industry nouns in code (ADR-033). Moving the admin renderer into a shared package is out of scope.
- C2 **Fix the submit 500 (found by M.6b):** `SubmitMyListingUseCase` (directory) lets a `ZodError` escape when a required custom field is missing, so the storefront answers 500. Convert it to the normal `VALIDATION_ERROR` with `details.fields` (field path `customFields.<fieldKey>`), the same shape the draft save uses. Test: `submitting a listing without a required field answers 422 with the field path`. The form shows the field errors on their steps.
- C3 **Steps:** one step per template section (`sectionKey`, in template order), the required fields of a step must be valid before "Next"; the draft saves on every step change (`PUT /my/listing` with `version`; a 409 shows the conflict message and reloads). Submit lists the consent checkboxes from `GET /directory/form` (the consents the template defines) and sends their keys.
- C4 **Credits and purchases** follow the M.5 API (`/my/credits`, `/credit-packs`, `POST /my/credit-purchases` with `Idempotency-Key`, own purchases with cancel). Payment info text comes from the business settings the API returns; nothing is hard-coded.
- C5 **Erase** uses the M.7 A2 OTP step: a separate code is sent to the customer's phone; the account and listing go away only after the code. Export downloads the JSON the API returns.
- C6 **Admin page editor** (decision 17): Markdown per locale, preview rendered by the storefront's Markdown rules from M.6b (`apps/storefront/src/markdown`). The admin cannot import it either: move the pure Markdown renderer into `packages/ui` (or a new folder in an existing package) so both apps use the same rules, or render the preview through a server action that calls the same function. Pick the package move if it is a pure function without Next dependencies; otherwise stop and ask.
- C7 **Browser tests** reuse the M.6b helpers (`publishTemplate`, `grantDirectoryModule`, `latestSmsCode` with `sentAfter`, the GEO_BD sample). The stacks run the worker: wait for results by reloading or polling, never race them. Node on Windows cannot resolve `*.sites.localhost`: tests that fetch with Node run on CI; Chrome resolves it everywhere.
- C8 **Budgets:** storefront ≤ 170 KiB per route measured as M.6b measures it; admin `website/pages` ≤ 180 KiB. The steps form, the credit purchase sheet and the erase dialog load lazily.

### Files (M.6c)
| Path | Create/Change | Owns / add-only | Purpose |
|---|---|---|---|
| `apps/storefront/src/**` (account pages, `fields/`, credits, connections, report, block, export, erase) | Create/Change | owns | decisions 15–16, C1, C3–C5 |
| `apps/api/src/modules/commerce/directory/**` | Change | owns | C2 |
| `packages/ui` (Markdown renderer moved) or a server action | Change | owns | C6 |
| `apps/admin/src/website/**`, `apps/admin/app/[orgSlug]/(app)/website/**`, the website manifest menu entry | Create/Change | owns / add-only | decision 17 |
| `packages/i18n` | Change | add-only | storefront account and admin editor text |
| handoff `docs/handoffs/M.6c-ui.md`, STATUS row M.6 | Change/Create | | |

### Tests (M.6c): the M.6c list in "Tests" above, plus C2's API test and unit tests of the field renderer (each type, GEO_BD dependent selects, required check per step).
