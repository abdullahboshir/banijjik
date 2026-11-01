# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-11-01 by Claude Opus 5.5 - `origin/main` = `4705eefb` (pushed): test-calendar fix `d63decde` (CI [41317935763](https://github.com/abdullahboshir/banijjik/actions/runs/41317935763) green) plus the 4.3 audit docs.

## 1. Where the project stands
- Roles from `docs/RUN-WITHOUT-CLAUDE.md`. Pushing `main` needs green CI on the exact head plus the owner's yes.
- **Card 4.3 is NOT COMPLETE.** Main track A0, A1, A2, A3C, A3S, A3B, A3E, A3P, A4, A5A, A5B, B1, B2, B3 are merged on `origin/main`. Still open: main-track **V** (commerce scenarios and storefront browser suite), all 15 mandatory **COD** parts (S1, S2, S3, C, R, P, J1, J2, I0, I1, I2, I3, B1, B2, V; none started), and the folded **4.6** acceptance tests. Evidence matrix: `docs/handoffs/4.3-completion-check.md`.
- 4.1 and 4.2 complete. 4.4 A1 + A1D merged; 4.4 rest and 4.5 not started. Phase 4 is not complete.
- **main CI is green again.** API tests run on a fixed calendar: `apps/api/src/test-support/fixed-calendar.setup.ts` (vitest `setupFiles`) swaps `Date` for a subclass offset to start at 2026-10-31T08:00Z, at real speed and ms resolution (fake timers were tried: their 20 ms steps tied ordered-event times). Test mongod runs with `ttlMonitorEnabled=false`. New date-bound tests assume that start date.
- Storefront delivery options stay disabled until COD I0-I3 and V pass.

## 2. Open branches (checked 2026-11-01)
- `s/4.3-v-commerce-scenarios` (folder `banijjik-1.7b`, T1): 4 commits ahead of main, adds mixed-commerce scenarios and the storefront browser suite; last CI run cancelled. Not mergeable yet (V waits for COD). Preserve; later `git merge origin/main` into it.
- No `s/4.3-cod-*` branch exists yet. The COD-S1 refresh (`docs/plans/4.3-COD-S1-refresh.md`, v9) is on main but based on old commit `39a258c0`.
- Merged, safe to remove (owner's call): `s/fix-month-flip-test` (`banijjik-fix-month-flip`), `s/docs-4.3-audit` (`banijjik-4.3-audit`), `s/docs-state-2026-11-01` (superseded), `s/4.3-a5a-review-fixes` (`banijjik-4.3-a5a-fixes`), `s/4.3-a5b-privacy-participants` (`banijjik-4.1-a1`), `s/ci-verify-timeout-30` (`banijjik-ci-timeout`). `banijjik` sits on merged `s/4.3-a5a-request-projections-claim`.

**Local test setup:** worktrees need `node_modules` junctions to `banijjik` (root and `apps/api`), `npm run build` in `packages/ids`, `contracts`, `validation` after branch changes, and run API tests with `--config src/test-support/vitest.config.ts`. Set `MONGOMS_SYSTEM_BINARY` to the cached mongod exe and `NODE_OPTIONS=--max-old-space-size=4096`. Without the config flag, tests fail with "reading 'replace'".

## 3. Waiting on the owner
- Optional cleanup of the merged worktrees/branches in section 2.
- Run the independent T1 plan check of the COD-S1 refresh with a different tool (Codex or Qoder) after the planner refreshes it against current main.
- Older: P1 rotate leaked secrets; Cloudflare staging credentials; product questions in earlier state (3.9 offline selling, M.6 listing noindex).

## 4. Next actions, in order
1. Refresh the COD-S1 plan against current main (new worktree, plan mode), then independent T1 plan check. Do not implement before it passes.
2. COD order, one part per session, own branch, different reviewer tool, green CI before merge: S1, S2, S3, C, R, P, J1, J2, I0, I1, I2, I3, B1, B2, V. Each later part gets its own just-in-time refresh and plan check.
3. Finish main-track V after COD (rebase-free: `git merge origin/main` into `s/4.3-v-commerce-scenarios`), plus the folded 4.6 checks.
4. Update `docs/handoffs/4.3-completion-check.md` with commits, reviews and CI links; mark 4.3 complete only when every gate holds and the owner approves the main inclusion.
5. Then 4.4 rest, 4.5, Phase 4 review. Follow-ups: 4.3 A1 review leftovers, A5A R3 minors (8), M.6a leftovers.

## 5. How the lead works
- **Role:** plans, T1 reviews, merge checks, fast-forward of `main`. Reply in Bengali script; code/docs in English.
- **Subagents & zero-idle pipeline (owner 2026-10-29):** Always run subagents with `Model: "flash"` (Gemini Flash) and separate roles (Implementer never reviews its own code). Never sit idle waiting for CI: launch the independent Reviewer subagent and prepare `docs/handoffs/<card>-review-R1.md`, `docs/handoffs/<card>.md`, `docs/STATUS.md`, and `docs/LEAD-STATE.md` **while CI is running**, then commit `docs/` (`paths-ignore: ["docs/**"]`) and fast-forward `main` as soon as CI turns green. Run independent parallel lanes in separate worktrees so their CI runs overlap. Never sacrifice code quality, completeness, or planned tests for speed.
- **Windows / PowerShell hygiene:** Always use `npm.cmd`, `npx.cmd`, and `& "C:\Program Files\GitHub CLI\gh.exe"`, quote git ranges (`"origin/main..HEAD"`), and use `node:http` (`fetchStorefront`) for loopback virtual-host headers on Windows.
- **Merge:** `git fetch origin && git merge origin/main` on the card branch. STATUS row merged on the branch, commit, push, wait green CI (docs-only uses the last code run). Then `git push origin <branch>:main`. If rejected, main moved: merge again. Never force-push.
- **card:check** must print PASS on every line (INFO about main is fine) before a review or merge.
- **Never:** `--no-verify`, resetting existing commits, committing `.env`, `git commit -a` in `banijjik` (picks up `.claude/settings.json`).
- **Docs commits:** `git switch -c s/docs-<slug> origin/main`, commit, `git push origin HEAD:main`.
- **Local verify:** `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe"` `MONGOMS_VERSION_CHECK=false` `TEST_REDIS_URL=redis://127.0.0.1:6380`. Do not run the root suite.
- **i18n / add-only conflicts:** keep both sides; catalogs join with a comma.
- Pushing `main` is allowed after green CI (owner 2026-10-23, 2026-10-25, 2026-10-28).

## 6. Session log (last five)
- **2026-11-01** (Claude Opus 5.5, `banijjik`): CI showed the fixed harness clock broke 23 tests; replaced it with a suite-wide offset `Date` (`fixed-calendar.setup.ts`), CI 41317935763 green; FF main to `d63decde`, merged `s/docs-4.3-audit` (`4705eefb`); cancelled stuck run 41181686484.
- **2026-11-01** (Claude Sonnet 5.5, `banijjik`): audited 4.3 against git and CI (not complete: COD 0/15, V unmerged); found main CI red from date-dependent tests; fixed harness clock and TTL monitor, event sales-close test and STATUS rows on `s/fix-month-flip-test`; waiting on CI.
- **2026-10-30** (Antigravity, `banijjik`): verified 4.3 A1 (`be5c8b9c`), completed T1 review (`4.3-a1-review-R1.md`); completed, T1-reviewed (R1 PASS) and merged 4.3 A2 (`738b441c`, CI 40992400902) and 4.3 A3C (`5308dd0d`, CI 40998523354); froze `Refresh A1-A3C`, `Refresh COD-S1`, and `Refresh A3S-A3E`.
- **2026-10-29** (Antigravity, `banijjik`): implemented, T1-reviewed (R1 PASS) and merged 4.2 C2 (`d6d845e3`, CI 40896729028) and 4.4 A1D (`90186f1b`, CI 40869825029) to `main`; Card 4.2 is 100% complete.
