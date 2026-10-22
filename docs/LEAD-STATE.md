# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-10-22 by Opus 5.5 · main `c4968f2` (pushed to GitHub)

## 1. Where the project stands
- Phase 3 merged: 3.0, 3.1a, 3.1b, 3.1c, 3.2a, 3.2b, 3.3, 3.4, 3.4b, 3.8a, 3.8c, 3.12, 3.13. Track M merged: M.1, M.2. Details per card: `docs/STATUS.md`.
- From 2026-10-22, every plan and session follows `docs/plans/parallel-sessions-guide.md`: Part A (API) and Part B (screens) per card, file ownership, fast local checks, full verification on GitHub CI for every pushed `s/**` branch, one finish checklist. Ready board: guide §9.

## 2. Open branches
| Branch | Folder | Tier | State and next step |
|---|---|---|---|
| `s/3.14-ci-card-branches` | `banijjik-docs` | T2 | Implemented by the lead: `s/**` push trigger and a `browser` job. Run `39719375443`: browser green (admin 90 passed, platform 16 passed, about 5 min), secrets green, verify failed once on `ordered-event-worker.test.ts` "runs a replayed event again with fresh attempts" (timing; the same code was green on main run `39719326709`). Failed job rerun started. If green: write `docs/handoffs/3.14.md`, STATUS row, ff main. If it fails again: record the flaky 3.8a test as a finding for a fix card. |
| `s/3.6-booking-core` | `banijjik-lead` | T1 | R1-1/R1-2 fixes committed (`b962581`). Next: review the delta, push the branch for CI, merge. |
| `s/m3-moderation-screens` | `banijjik-1.7b` | T2 | Rebased on an older 3.6 head (`cdd75a1`); verified except the 3.6 SALON test. Next: rebase on main after 3.6 merges, CI, merge check, merge. |
| `s/m4-credits` | `banijjik-m2` | T1 | Another Opus review (`docs/handoffs/M.4-review.md`): PASS WITH FIXES, B1 storefront credit routes not module-gated, B2 `CreditEntry` not append-only. Fix commit `3fd0c89`. Next: review the delta, rebase, CI, merge. |
| `s/3.8b-bookkeeping` | `banijjik` | T1 | Cursor says finished (`693f223`, `997d13c`). The folder has **uncommitted out-of-scope edits** to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). Next: ask the owner whether to keep them as a separate docs change; then the full T1 review. |
| `s/docs-lead-state` | `banijjik-docs` | docs | This file and the `/lead` and `/save-state` skills. |

## 3. Waiting on the owner
- Keep or drop the `AGENTS.md` / `05-CONVENTIONS.md` edits found in the 3.8b folder.
- Standing permission to push `main` after each reviewed merge (asked 2026-10-22; until answered, ask before each push of `main`). Card-branch pushes need no permission.
- Older open items: P1 rotate leaked secrets (repo is public), phone usability check (deferred by the owner), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. Finish 3.14 (see §2), then merge it so every card branch gets CI.
2. Review and merge 3.6, then M.3 (rebased), M.4, 3.8b, one by one, each green on CI after its rebase.
3. Give the owner the 3.5a Part A prompt (guide §6) for a free folder or a cloud agent.
4. After 3.6 merges: refresh plans 3.8 and 3.7 (based on `3c0165b`, older than 3.8c and 3.6), then 3.8-A and 3.7-A; plan 3.6b.
5. After M.4 merges: M.5 Part A.
6. Later: 3.5b, 3.9 POS, 3.11, 3.10, M.6 to M.9, then the Phase 3 review (`docs/handoffs/phase-3-review.md`).

## 5. How the lead works
- **Role:** plans (just in time), strict T1 reviews, merge checks, integration (rebases, conflicts), fast-forward of `main`. Implementation is done by the owner's Cursor sessions (sometimes Claude Code or Qoder), not by the lead, unless the owner asks.
- **Language:** reply to the owner in Bengali script; code, comments and docs in English.
- **Review:** read the diff against the plan and `AGENTS.md`; try to break T1 security, money, stock and concurrency rules; require a green CI run on the branch head. Never accept an implementer's report as proof; check branches and commits yourself (Cursor chats often leave work uncommitted or claim parts done that are missing).
- **Integration habits:** Cursor branches tend to refactor `routes/v1.ts` and the router builders. Keep the 3.8c layout (`routes/core-tenant-routers.ts`, `routes/tenant-module-routers.ts`, `routes/iam-tenant-router.ts`). i18n catalog end-of-file conflicts: keep both sides joined by a comma. Keep `\\.` escaping in `eslint/restrictions.mjs`.
- **Folders:** one chat per folder. `banijjik`, `banijjik-1.7b`, `banijjik-lead`, `banijjik-m2` have their own `node_modules`. `banijjik-docs` is light: its `node_modules` is a junction to `banijjik`'s (enough for the commit hooks; not for builds). Disk is nearly full (E: about 5.5 GB, C: about 4.3 GB free), so there are no new full folders. Extra sessions run as cloud agents.
- **Docs commits:** in `banijjik-docs`, `git switch -c s/docs-<slug> main`, commit, then from any folder `git fetch . s/docs-<slug>:main` (fast-forward only).
- **Local verify** (only for integration of several branches; one heavy run at a time): environment `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe" MONGOMS_VERSION_CHECK=false TEST_REDIS_URL=redis://127.0.0.1:6380 NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_BRAND_NAME=Example CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`. Then `npm run lint`, `npm run format:check`, `VITEST_MAX_WORKERS=2 npx turbo run build typecheck test --force --env-mode=loose --concurrency=1 --continue`, and the browser suites with `VITEST_MAX_WORKERS=1 npm run test:browser` in `apps/admin` and `apps/platform`. Move `apps/api/.env` aside during the run (it exists only in `banijjik`) and put it back. Docker (`infra/docker-compose.yml`: Mongo 27018, Redis 6380) may need starting after a reboot; never touch other containers.
- **Never:** `--no-verify`, resetting existing commits, committing `.env` files, printing env values, pushing `main` without permission.
- **Token cost** (measured 2026-10-22): about 90% of a day's usage went to carrying a 900k-token session, mostly full cache rewrites after a break of over an hour or a `/model` switch. Keep sessions short: one task, then `/save-state`, then a new session with `/lead`.

## 6. Session log (last five)
- **2026-10-22** (Opus): wrote the parallel sessions guide, plans 3.14, 3.5a, M.5, session parts for 3.7 and 3.8; pushed main `c4968f2`; implemented 3.14 (CI rerun pending); token-usage analysis; created this file and the `/lead` and `/save-state` skills.
- **2026-10-20 to 21** (Opus): merged 3.8c, 3.4, 3.3 and M.2 together (`8258669`); planned 3.8b, M.3, M.4; reviewed 3.6 (R1: bookable service fields missing in the offering editor).
- **2026-10-19** (Opus): merged M.1 and 3.4b; planned 3.4, 3.4b, 3.6, 3.8, 3.8c, 3.3, 3.7, M.2.
