# Handoff: card M.6 part c (signed-in storefront pages, admin page editor) · IMPLEMENT · 2026-10-25

- **Branch:** `s/M.6c-ui-storefront-account`, from `origin/main` (`97b16016`, M.6b merged), rebased on `origin/main` (`069b48a6`) before the push.
- **Model:** Claude Haiku 5.5 (Claude Code). The run was cut off once and resumed from the committed state.
- **Plan:** `docs/plans/M.6.md`: decisions 15 to 17, the "Refresh M.6c" section (C1 to C8), the M.6c files and test list.
- **CI:** see the STATUS row (run link added after the green run).

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
| unit: field renderer (each type, GEO_BD options, required check per step) | `apps/storefront/src/fields/field-rules.test.ts` (7 tests) | ran locally: 7 passed |
| C2 API test | `directory-api.test.ts` `submitting a listing without a required field answers 400 with the field path` | ran locally: 1 passed (and the whole file: 9 of 9 with the website file, see below) |
| admin unit: draft validation and save body | `apps/admin/src/website/site-page-draft.test.ts` (3 tests) | ran locally: 3 passed |
| API: directory, website, menu, entitlement files (after the rebase) | `directory-api.test.ts`, `website-api.test.ts`, `me-config-menu-api.test.ts`, `entitlement-api.test.ts` | ran locally: 23 of 23 (menu and entitlement), 18 of 19 with a 30 s timeout in the website file during a parallel typecheck, then 10 of 10 alone |
| browser: fill biodata, submit, staff approve, unlock, buy, report, block, export, erase asks for the code | **not written** | see known gaps |
| browser: admin edit and publish, storefront shows it, stale save shows the conflict, staff read-only | **not written** | see known gaps |
| budgets: storefront ≤ 170 KiB, admin route ≤ 180 KiB | the CI browser suite measures the storefront routes it already tests (`/`, `/search`, `/listings/<n>`, `/sign-in`) | see measured sizes |

Local runs: `apps/storefront` `next build` passes; `eslint` (the pre-commit rules) passes for storefront and admin files; `tsc --noEmit` passes for storefront and admin.

## Measured sizes

- Not measured per route. The CI browser budget test (M.6b, gzip of the HTML scripts, 170 KiB) gives the authoritative numbers; it does not cover the new routes `/my/*` yet.
- Local attempt: with the API unreachable, the HTML of an error shell referenced 6 scripts totalling 167.6 KiB gzip. This shell is not a route; it only shows the shared layout is close to the 170 KiB budget. The M.6b CI run measured 149 KiB for `/`. Watch this number in CI.
- Admin `website/pages` route: not measured locally (admin build not run).

## Deviations from the plan (and why)

1. **Error code and status for the field problem.** The plan says `422 VALIDATION_ERROR`. This codebase maps `VALIDATION_ERROR` to 400 (`packages/contracts/src/errors/error-code.ts`), and the request validation uses the same code. The implementation uses the code and its status (400). The lead should confirm.
2. **Draft save also converts the value error.** The plan names only the submit. The draft save (`UpsertMyListingUseCase`) also parsed with `.parse` and could return a 500 for a wrong value type. It now uses the same mapping. The plan's "the same shape the draft save uses" assumed this already existed.
3. **Client checks are the required check only.** The plan says the shared value schema for client checks. `buildCustomFieldValuesSchema` needs the full field rule (visibility, sensitivity, search flags), which the public form read does not carry. The storefront checks required fields per step; the API checks everything else and its field problems are shown on their steps.
4. **Upazila is not drawn.** The plan says upazila "when the field asks for it". No field definition carries such a flag, so GEO_BD shows division and district only.
5. **`@banijjik/ids` moves to dependencies** (see the lock note above).
6. **`renderMarkdown` on a subpath** (`@banijjik/ui/markdown`), not the main barrel: the barrel is loaded by every page.

## Known gaps (for review)

- **Browser suites (plan tests) not written.** The CI browser suites for the M.6c flows and the admin editor are missing. The unit and API tests listed above exist and passed locally.
- **Photo upload is not built.** The plan asks for the upload field when `photoPolicy` is not `NONE`. The default policy is `NONE` (no upload), so nothing is missing at the default. Upload is a follow-up.
- **Clearing an optional field does not clear it on the server.** The draft save merges the customFields (`{ ...existing, ...parsed }`), and the storefront leaves blank answers out of the payload. A cleared optional value keeps its old value. This needs an API decision (for example, an explicit null) before it is fixed.
- **Rejection reasons are shown as the raw keys** from `listing.rejection.reasonKeys`. The public form read has no reason labels; the note is shown. Labels need a read the owner may use (an API decision).
- **Pending confirmation text.** The unlock, block and report buttons show a text after success; they do not refresh the connections list until the next visit.
- **`/my/listing` status for APPROVED listings is read-only.** An approved listing that the owner changes goes back to review in the API; the storefront does not offer that edit yet.
- **Idempotency keys:** each unlock press sends its own key (no retry reuse on the listing page); the purchase form keeps one key per draft until success.
- **Admin editor preview** shows the same rules as the storefront (no raw HTML). Images and links to `http`/`https`/`mailto` only.
