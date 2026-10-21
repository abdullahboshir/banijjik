# Handoff: card M.3 · IMPLEMENT · 2026-10-20

- **Branch / commit:** `s/m3-moderation-screens` (main commits: API `4a50e97`, screens `60d9798`, browser/budget fix `18970be`). Not merged/pushed.
- **Model:** Cursor (Composer)
- **Done:**
  - Admin moderation: queue (`/directory/queue`), all listings with filters (`/directory/listings`), review page with tier chips, local reject checklist, approve/reject/hide/unhide
  - Shell queue badge on `directory.queue` (SUBMITTED total; quiet skip when menu/permission absent)
  - Menu, LISTING status tones, BN/EN screen keys; review actions lazy-loaded for the 170 KiB budget
  - Lead API gap (ADR-129): `GET /directory/config`, staff `GET /directory/listings`, remove `reviewChecklist` from listing detail; tests + docs/14
- **Verified with:**
  - `npm run lint` → exit 0
  - `npx turbo run typecheck --filter=@banijjik/admin --filter=@banijjik/ui --filter=@banijjik/i18n --filter=@banijjik/api` → 10/10
  - `npm test -w @banijjik/admin -- src/directory` → **9 passed**
  - `npm test -w @banijjik/api -- src/modules/commerce/directory` → **29 passed**
  - `npx turbo run build --filter=@banijjik/admin` → ok (directory routes present)
  - `npm run test:browser -w @banijjik/admin -- src/directory/directory.browser.test.ts` → **2 passed** (flow + ≤170 KiB)
  - `npm run format:check` after Prettier on touched files
- **Not done / known gaps:**
  - Full-repo turbo test/build without cache not re-run in the finish pass (scoped verifies above)
  - Merge check / push not done (owner)
  - RETAIL seed still omits `directory` from `allowedModuleKeys`; browser test patches the template allow-list (same pattern as PLATFORM_GRANT + allow-list in resolution)
- **Deviations from plan (and why):**
  - Plan assumed sections lazy-loaded; shipping **server-rendered** `ListingSections` and **lazy `ReviewActions`** instead so fields appear in SSR HTML and initial JS stays ≤ 170 KiB
  - Reject checklist = rejection reasons (local only), not section keys — lead answer / ADR-129
  - Distinct `directory.reject.submit` copy so it does not collide with `directory.action.reject` in BN/EN (browser click-by-name)
- **Decisions made:** ADR-129 Accepted (proposed) for the three staff read API pieces; recorded in `docs/04-DECISIONS.md` and the API commit
- **Notes for the next session:**
  1. Branch `s/m3-moderation-screens` in this worktree; do not merge/push until merge check
  2. Consider adding `directory` to matrimony (or chosen) industry seed `allowedModuleKeys` so PLATFORM_GRANT is not blocked by step 2 of the resolver
- **Next suggested card / pair:** M.3 merge check → M.4 (credits/connections) or next planned card

## Follow-up review · 2026-10-21 · Codex

Scope: M.3 only, existing `s/m3-moderation-screens` worktree `banijjik-1.7b`; preserved the two pre-existing uncommitted queue changes. This is an implementation/review follow-up, not the named-model independent merge check.

Changes:
- Completed queue paging via URL search parameters, 50 rows per request, previous/next navigation, and a return link from an empty later page.
- Queue cards preview only the first section's PUBLIC fields (missing tier retains the existing PUBLIC default). MEMBERS, UNLOCKED and PRIVATE values remain available on the full staff review screen but are excluded from queue previews.
- Non-conflict moderation failures now show the existing translated `errors.internal` alert, retain selected rejection reasons and note, clear busy state, and do not navigate or refresh as success. Conflicts retain their distinct reload message.
- Ignore another approval click while an action is pending; allow long preview values to shrink and wrap on phones.
- Regression coverage: queue pagination and visibility tiers, malformed pages, empty-page recovery, permission denial without fetching tenant data, rejection failure preserving inputs, hide/unhide requests and refresh behavior.

Verification so far:
- `git diff --check`: pass.
- `npm test -w @banijjik/admin -- src/directory`, `VITEST_MAX_WORKERS=1`: **6 files, 20 tests passed**.
- Initial uncached full build: stopped with Node `Zone Allocation failed - process out of memory` in API compilation (exit 134); remaining commands in that batch did not run.
- Retrying build and remaining required checks with bounded Node heap and one test worker under `Local\BanijjikHeavyVerification`; final result recorded below when complete.

Safeguards and limits:
- No API/schema/persistence/cache change or data migration. Existing API permission, entitlement, tenancy and optimistic version checks remain authoritative; no new retry mechanism or side effect.
- Existing M.2 API tests cover cross-org refusal; this follow-up's queue test checks that a read-denied UI never requests tenant resources.
- Existing browser setup inserts/resubmits directly in MongoDB, rather than through the storefront API requested by the plan. Its existing passing result is historical; do not claim that fixture requirement is satisfied. Current browser, mobile and route-budget results are pending.
- Full checks and owner/planner T2 merge check remain required; not merge-ready. No merge, push or deploy performed.

## Verify pass · 2026-10-21 · Qoder

Scope: read AGENTS.md, this handoff and `docs/plans/M.3.md`; audited `git diff main...HEAD` (60 files) against the plan and the hard rules; then ran the full verification without turbo cache. A concurrent Codex follow-up staged edits in this same worktree during the pass (see "Concurrent edits"); the whole current tree was verified, not only this session's hunks.

Audit findings (fixed):
- Queue cards previewed every tier of the first section. The plan asks for the key **public** fields, so the preview now filters `(listingTier ?? PUBLIC) === PUBLIC`; MEMBERS/UNLOCKED/PRIVATE values stay on the review page only.
- The queue was a single 50-row page. The plan requires "paged (≤ 50)", so `/{orgSlug}/directory/queue` now forwards `?page=`, asks the API for `page` + `limit=50`, and renders previous/next plus a back link from an empty later page.
- Queue tests covering paging, malformed pages, empty-page recovery and tier filtering live in `queue-page.test.tsx`.

Audit findings (no change):
- Seeds: leaving `directory` out of every template's `allowedModuleKeys` is justified: ADR-127 says no template enables the module yet (M.8), the M.3 plan has no seed task, and `industry-template-seeds.test.ts` pins the seed module counts. The browser test mirrors resolver steps 1–2 with a PLATFORM_GRANT override plus `$addToSet` on the template, the same shape the resolver requires.
- Test fixture deviation (not listed before): the plan asks for a listing created through the M.2 storefront API and resubmitted through the API; the browser test inserts and resubmits directly in MongoDB. Test-only shortcut; the moderation screens are exercised, and M.2's API is covered by its own suites. Left as-is and recorded here.
- `docs/14-API.md` has a pre-existing structural oddity (storefront checkout rows after the customer-route note without a header); it predates M.3 and was not changed.

Concurrent edits: while this pass ran, a Codex session staged `review-run.ts`, `review-actions.tsx`, `review-panel.tsx`, `review-action-handlers.ts`, `review-action-labels.ts`, `queue-card.tsx`, `review-actions.test.tsx`, `queue-page.test.tsx`, `directory.browser.test.ts`, this handoff and the STATUS row (mtimes 17:25–17:34). The changes are inside M.3 scope (non-conflict failure alert `errors.internal`, no double submit while busy, long preview values wrap on phones, extra tests). They were audited and are part of the final commit; the scoped and full admin suites below ran on that combined tree.

Verification (real output, turbo cache bypassed; `apps/{admin,platform}/.env.local` copied from the main worktree because the platform build requires `NEXT_PUBLIC_*`):
- `npx turbo run build --force --concurrency=1` → **9/9 tasks, 0 cached, 39.7s**; admin builds `/[orgSlug]/directory/queue`, `.../listings`, `.../listings/[listingId]`. (A parallel build first died with Windows `os error 1450`/Node OOM; serial passed.)
- `npm run lint` → **exit 0** (first attempt aborted with a V8 OOM under concurrent machine load; retry passed)
- `npm run format:check` → **All matched files use Prettier code style!**, exit 0
- `npx turbo run typecheck --force --concurrency=2` → **16/16 tasks, 0 cached**
- API suite: one process cannot finish on this machine (V8 OOM / Windows worker exit 0xC0000005 with 0.5–1.5 GB available). Ran four shards (`--maxWorkers=1 --no-file-parallelism --shard=n/4`, `TEST_REDIS_URL=redis://127.0.0.1:6380`, mongo temp on F:):
  - shard 1: 54/55 files, **503 tests passed**; one unrelated file lost to a worker access violation
  - shard 2: 55/55 files, **462 passed**
  - shard 3: 54/55 files, **350 passed** + 7 skipped; one unrelated suite failed with Mongo `ECONNRESET`
  - shard 4: 54/54 files, **579 passed** + 1 skipped (`it.skipIf(IS_WINDOWS)` in `main.test.ts`)
  - the two lost files re-run alone: **2/2 files, 13/13 tests passed**
  - total **219/219 files green, 1907 tests passed, 1 intentional skip**; directory API `directory-api.test.ts` **8/8**.
- Other workspaces (run before the Codex edits, which touch admin only): contracts 17 files/74 tests, validation 24/244, i18n 6/24, web-client 13/97, ids 2/14, ui 28/236, platform 22/123.
- Admin full suite after the Codex edits (`--maxWorkers=1`): **91 files, 527 tests passed**; scoped directory **6 files, 20 tests passed**.
- Browser (`CHROME_PATH=…`, `TEST_REDIS_URL=…`, `npm run test:browser -w @banijjik/admin -- src/directory/directory.browser.test.ts`): **2/2 passed** — queue → review (PRIVATE labelled "শুধু অফিস", queue has no private value) → reject → resubmit → approve → all listings; 375 px has no sideways scroll; route budget ≤170 KiB.

Remaining: T2 merge check by the owner/planner; branch not merged or pushed. The single-process API command is not runnable on this machine while other sessions hold memory; use shards or run when idle.