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
