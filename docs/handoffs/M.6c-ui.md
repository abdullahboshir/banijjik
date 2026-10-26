# Handoff: card M.6 part c (signed-in storefront pages, admin page editor) · IMPLEMENT · 2026-10-25

- **Branch:** `s/M.6c-ui-storefront-account`, from `origin/main` (`97b16016`, M.6b merged), rebased on `origin/main` (`069b48a6`) before the push.
- **Model:** Claude Haiku 5.5 (Claude Code). Review R1 by the lead, then a fix round (see Review R1 below).
- **Plan:** `docs/plans/M.6.md`: decisions 15 to 17, the "Refresh M.6c" section (C1 to C8), the M.6c files and test list.
- **CI:** green on run 40235017118 (head `47067c95`, verify and browser jobs).

## Done

**API (C2).** `SubmitMyListingUseCase` (and the draft save, see deviations) parse the custom field values with `safeParse`. A value the form rules refuse becomes `VALIDATION_ERROR` with `details.fields` whose paths are `customFields.<fieldKey>` (`directory/application/use-cases/my-listing.use-cases.ts`, `domain/errors.ts` `customFieldsInvalid`). Test: `submitting a listing without a required field answers 400 with the field path` (`directory-api.test.ts`).

**Markdown (C6).** The pure renderer moved from `apps/storefront/src/markdown` to `packages/ui/src/markdown/render-markdown.ts` (with its test). It is exported on its own subpath `@banijjik/ui/markdown` (not the main barrel, so pages that do not render Markdown do not carry `markdown-it`). The storefront static page and the admin preview both use it.

**Storefront (decisions 15 and 16, C1, C3 to C5).**
- Field renderer in `apps/storefront/src/fields/`: `field-input.tsx` draws the 12 field kinds (TEXT, LONG_TEXT, NUMBER, DECIMAL, BOOLEAN, DATE, SELECT, MULTI_SELECT, PHONE, EMAIL, URL, GEO_BD); labels from `label.bn`/`label.en`; GEO_BD is division then district from the BBS registry. Unknown types fall back to a text input.
- Biodata at `/my/listing`: one step per template section (order from the template), consents as the last step when the template has any; each step saves the draft with `PUT /my/listing` and `version`; a 409 reloads the page with the conflict message; submit sends `consents` keys; the API's field problems are shown on the step that holds the field. Archive asks for a second click (`archive-listing-button.tsx`). The steps form loads lazily.
- `/my/connections` (unlocked listings and hidden listings with "show again"), `/my/credits` (balance, packs, payment info, a buy form with a transfer reference and `Idempotency-Key`, own purchases with cancel for PENDING), `/my/account` (export downloads the JSON the API returns; erase asks for a code sent to the phone through `POST /my/account/erase/otp`, the account goes only after `POST /my/account/erase`).
- Listing page, signed in: unlock (credits, when the credit module is on), hide from my search, and a report form (reasons from `/listing-report-reasons`, lazy).
- The header shows the account links when signed in. Lazy loading (`next/dynamic`, async import) for the steps form, the purchase form, the erase dialog and the report form.

**Admin (decision 17).** `apps/admin/src/website/`: the page list `/{orgSlug}/website/pages` (six pages, one editor each): title and Markdown body per language, a live preview with the same renderer, the publish switch, and a versioned save (`PUT`, stale version shows the conflict text). Staff with read only see the page read-only. Manifest menu entry under settings (`website.pages`, `globe` icon, `SETTINGS_TOPIC.WEBSITE`, permission `website.page.read`).

**i18n.** `storefront.*` keys in `packages/i18n/src/catalogs/storefront/{bn,en}.json` and `menu.website.pages` and `website.pages.*` in the top-level `bn.json` and `en.json` (add-only).

**Lock and dependencies.** `package-lock.json` changes only mirror manifest moves: `markdown-it` `14.3.3` and `@types/markdown-it` `14.1.2` move to `packages/ui` (C6; no new external package), and `@banijjik/ids` moves from `devDependencies` to `dependencies` of `apps/storefront` (the browser code creates Idempotency-Keys with `newId`, as the admin does). No package was added from outside the monorepo.

**Test-list updates (add-only, after the website menu entry was added).** `me-config-menu-api.test.ts` (the settings list gets `website.pages`) and `entitlement-api.test.ts` (menu keys and the owner's menu permissions get `website.pages` and `website.page.read`).

## Tests

| Plan test | Where | Status |
|---|---|---|
| unit: field renderer (each type, GEO_BD options, required check per step) | `apps/storefront/src/fields/field-rules.test.ts` (7 tests) | local: 7 passed; CI green |
| unit: photo upload only when the photo policy allows it | `apps/storefront/src/account/photo-upload.test.ts` | local: 1 passed; CI green |
| C2 API test | `directory-api.test.ts` `submitting a listing without a required field answers 400 with the field path` | local: passed |
| admin unit: draft validation and save body | `apps/admin/src/website/site-page-draft.test.ts` (3 tests) | local: 3 passed |
| API: directory, website, menu, entitlement files | `directory-api.test.ts`, `website-api.test.ts`, `me-config-menu-api.test.ts`, `entitlement-api.test.ts` | local: 23 of 23 (menu and entitlement); website 10 of 10 alone |
| browser (storefront): fill the biodata steps, save a draft, submit with consents, SUBMITTED; staff approval puts the listing in search; unlock with credits; buy a pack (PENDING); report, block; export downloads JSON; erase asks for the code | `apps/storefront/src/account-pages.browser.test.ts` | CI green (run 40235017118) |
| browser (admin): edit and publish a page, the storefront read shows it | `apps/admin/src/website/website-pages.browser.test.ts` | CI green |
| browser (admin): a stale save shows the conflict message | same file | CI green |
| browser (admin): staff sees the editor read-only | same file (invites a staff member through the UI) | CI green |
| budgets: storefront routes ≤ 170 KiB | `apps/storefront/src/storefront.browser.test.ts` | CI green |
| budget: admin `website/pages` ≤ 180 KiB | `apps/admin/src/website/website-pages.browser.test.ts` | CI green |

## Measured sizes (CI run 40235017118; KiB gzip of the scripts in the HTML, the same method as M.6b)

- Storefront: `/` 151.0, `/search` 151.0, `/listings/BIO-1` 153.8, `/sign-in` 152.7, `/my/listing` 152.4, `/my/credits` 153.0, `/my/connections` 151.3, `/my/account` 153.0. Budget 170.
- Admin `/acme/website/pages`: 169 KiB. Budget 180. The Markdown preview loads after the page is drawn (`markdown-preview-lazy.tsx`); before that change the route measured 212.7 KiB.

## Review R1 (lead merge check R1) and the fix round

The three items of R1 are fixed:

1. **C7 browser tests:** written and green on CI (see the table). Two helpers were fixed on the way: the admin publish switch is confirmed checked before the save (the first CI run saved an unpublished page, so the storefront read was 404), and form values are set through the element's own native setter (`account-pages.browser.test.ts`).
2. **C8 route sizes:** the four `/my/*` routes are in the storefront budget test (measured with the customer's cookie); the admin `website/pages` route is in the admin browser test. Numbers above.
3. **Decision 15 photo upload:** `PhotoUploadInput` (`apps/storefront/src/account/photo-upload-input.tsx`) is shown on the last step when the photo policy is not `NONE` and the listing exists (the upload attaches to an existing listing). It posts multipart field `file` to `/my/listing/photos` and reloads the page, because the upload changes the listing version. Unit test: `shows the photo upload only when the photo policy allows it`.

Also in the fix round: the admin test uses the `acme` business (the invitation helper in `browser-helpers.ts` opens `/acme` only). Other jobs: the `payments` admin browser test failed on earlier heads (a booking 409 near midnight); card 3.37 fixed it on main and this branch is rebased on that main.

## Accepted follow-ups (written to the STATUS M.6 row, not built here)

- Clearing an optional field keeps the old value (the draft save merges `customFields`); needs an API decision.
- Rejection reasons are shown as raw keys (no label read for the owner); needs an API decision.
- An APPROVED listing is read-only in the storefront (the API sends an edit back to review).
- The connections list refreshes on the next visit, not after an unlock or block.
- Each unlock press sends its own `Idempotency-Key` (no reuse across presses).

## Deviations from the plan (and why)

1. **Error code and status for the field problem.** The plan says `422 VALIDATION_ERROR`. This codebase maps `VALIDATION_ERROR` to 400 (`packages/contracts/src/errors/error-code.ts`). Accepted by the lead (R1).
2. **Draft save also converts the value error.** The plan names only the submit. The draft save also parsed with `.parse` and could return a 500. It now uses the same mapping. Accepted by the lead.
3. **Client checks are the required check only.** The shared value schema needs the full field rule, which the public form read does not carry; the API's field problems are shown on their steps. Accepted.
4. **Upazila is not drawn.** No field definition carries an upazila flag; GEO_BD shows division and district. Accepted.
5. **`@banijjik/ids` moves to dependencies** (the browser code creates Idempotency-Keys); the lock change only mirrors that move and the `markdown-it` move into `packages/ui`. No new external package. Accepted.
6. **`renderMarkdown` on a subpath** (`@banijjik/ui/markdown`), not the main barrel. Accepted.
7. **Photo upload waits for the listing** (see item 3 above).
8. **The admin page preview is lazy-loaded** so the route stays within 180 KiB (see the sizes above).
