# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-11-02 by Cursor Auto (lead merge) — `origin/main` = `eb6e1d9e` (4.3 COD S1b docs merge; code head `83d96e85`).

## 1. Where the project stands
- Roles from `docs/RUN-WITHOUT-CLAUDE.md`. Pushing `main` needs green CI on the exact head plus the owner's yes. Docs-only commits skip CI (`paths-ignore: ["docs/**"]`).
- **Card 4.3 is NOT COMPLETE.** Main track A0–A5B, B1–B3, **V0**, **V**, **COD S1a**, and **COD S1b** are on `origin/main`. Still open: COD **S1c** (starting) through **S1f**, then C, R, S2, S3, P, J1, J2, I0–I3, B1, B2, V-cod, and the folded **4.6** acceptance **implementation** (plan now on main). Evidence matrix: `docs/handoffs/4.3-completion-check.md`.
- **4.3 V0** merged (2026-11-02): storefront checkout session fixes plus D7 leaked-price restore. Code `e78083e4`; CI [41389405302](https://github.com/abdullahboshir/banijjik/actions/runs/41389405302) green.
- **4.3 V** merged (2026-11-02): API commerce scenarios only; storefront taken from V0/main at join `32bcfa64`; docs `8e67c94d`.
- **4.3 COD S1a** merged (2026-11-02): delivery-zone/attempt data. Code `e2a6bcfd`; T1 R2 PASS `2f46701a`; CI [41398058318](https://github.com/abdullahboshir/banijjik/actions/runs/41398058318) success.
- **4.3 COD S1b** merged (2026-11-02): delivery-zone API (no UI). Code `83d96e85`; T1 R1 PASS `f9b619c4`; CI [41402885747](https://github.com/abdullahboshir/banijjik/actions/runs/41402885747) success. JS budget still 180.
- **Folded 4.6 acceptance plan** merged (2026-11-02, docs-only): `docs/plans/4.3-4.6-acceptance.md` at `38d5b01e`. Checks 1, 2, 3, 5 remain; check 4 dropped as proven on V. File-disjoint from COD S1c.
- COD-S1 refresh v11 + T1 plan-check PASS on main (`docs/plans/4.3-COD-S1-refresh.md`, `docs/handoffs/4.3-cod-s1-plan-check.md`). Last LEAD-STATE save before this one: `7c257ae3`.
- 4.1 and 4.2 complete. 4.4 A1 + A1D merged; **4.4 rest not started.** 4.5 not started. Phase 4 is not complete.
- API tests run on a fixed calendar (`apps/api/src/test-support/fixed-calendar.setup.ts`, start 2026-10-31T08:00Z, real speed); test mongod has `ttlMonitorEnabled=false`.
- Storefront delivery **options** stay disabled until COD I0–I3 and V-cod pass. Do not guess OQ-5 for public place.

## 2. Open branches (checked 2026-11-02)
- `s/4.3-cod-s1c-order-delivery` (folder `banijjik-4.3-cod-s1c`, T1): implementer starting from `eb6e1d9e`. Do not edit this worktree from other sessions. Next: S1c (order delivery state, address, complete guard) per `docs/plans/4.3-COD-S1-refresh.md`; independent T1 review; green CI. S1c+S1d stay one main gate — do not FF `main` after S1c alone.
- `s/4.3-4.6-acceptance` (folder `banijjik-4.3-4.6`, T1): implementer started from `cf0e0491`; rebase onto `origin/main` (`eb6e1d9e`) to pick up S1b and the frozen plan, then implement Parts A then B exactly per `docs/plans/4.3-4.6-acceptance.md`.
- `s/docs-4.3-4.6-acceptance` merged into `main` as `38d5b01e` (folder `banijjik-docs-4.3-4.6-acceptance` now idle).
- No `s/4.3-cod-s1d-*` or `s/4.3-cod-s1e-*` branch. **S1d and S1e are not started.**
- Merged, safe to remove (owner's call): `s/4.3-cod-s1b-delivery-api` (`banijjik-4.3-cod-s1b`), `s/4.3-v0-checkout-session` (`banijjik-v0`), `s/4.3-v-commerce-scenarios` (`banijjik-1.7b`), `s/4.3-cod-s1a-delivery-data` (`banijjik-4.3-cod-s1a-delivery` / `banijjik-4.3-cod-s1a`), `s/fix-month-flip-test` (`banijjik-fix-month-flip`), `s/docs-4.3-audit` (`banijjik-4.3-audit`), `s/4.3-a5a-review-fixes` (`banijjik-4.3-a5a-fixes`), `s/4.3-a5b-privacy-participants` (`banijjik-4.1-a1`), `s/ci-verify-timeout-30` (`banijjik-ci-timeout`). `banijjik` local `main` may sit behind `origin/main`. `banijjik-docs` is the docs worktree.

**Local test setup:** worktrees need `node_modules` junctions to `banijjik` (root and `apps/api`), `npm run build` in `packages/ids`, `contracts`, `validation` after branch changes, and run API tests with `--config src/test-support/vitest.config.ts`. Set `MONGOMS_SYSTEM_BINARY` to the cached mongod exe and `NODE_OPTIONS=--max-old-space-size=4096`.

## 3. Waiting on the owner
- **OQ-4** (public fulfillment / shipment number) and **OQ-5** (when public COURIER/OWN_RIDER becomes placeable) are still unanswered. Do not guess. They do **not** block S1c or 4.6 acceptance.
- Optional cleanup of the merged worktrees/branches in section 2.
- Older: P1 rotate leaked secrets; Cloudflare staging credentials; product questions in earlier state (3.9 offline selling, M.6 listing noindex).

## 4. Next actions, in order
1. Implement **4.3 COD S1c** from `eb6e1d9e` on `s/4.3-cod-s1c-order-delivery`. Independent T1 review, green CI. Do not touch that worktree from other sessions. Do not FF `main` until S1d is also on the head (one main gate).
2. In parallel (file-disjoint): implement **4.3-4.6-acceptance** from `docs/plans/4.3-4.6-acceptance.md` on `s/4.3-4.6-acceptance`.
3. Then **S1d** (same main gate as S1c), then **S1e**, then **S1f**. Do not start S1d or S1e now.
4. Remaining COD, one part per session, own branch, different reviewer tool, green CI before merge: C, R, S2, S3, P, J1, J2, I0, I1, I2, I3, B1, B2, V-cod.
5. Do **not** start 4.4 rest.
6. Update `docs/handoffs/4.3-completion-check.md` (V0, V, S1a, S1b, S1c, 4.6 follow-up); mark 4.3 complete only when every gate holds and the owner approves.

## 5. How the lead works
- **Role:** plans, T1 reviews, merge checks, fast-forward of `main`. Reply in Bengali script; code/docs in English.
- **Subagents & zero-idle pipeline (owner 2026-10-29):** Always run subagents with `Model: "flash"` (Gemini Flash) and separate roles (Implementer never reviews its own code). Never sit idle waiting for CI. Never sacrifice code quality, completeness, or planned tests for speed.
- **Windows / PowerShell hygiene:** Always use `npm.cmd`, `npx.cmd`, and `& "C:\Program Files\GitHub CLI\gh.exe"`, quote git ranges (`"origin/main..HEAD"`), and use `node:http` (`fetchStorefront`) for loopback virtual-host headers on Windows.
- **Merge:** `git fetch origin && git merge origin/main` on the card branch. STATUS row merged on the branch, commit, push, wait green CI (docs-only uses the last code run). Then `git push origin <branch>:main`. If rejected, main moved: rebase the docs commit onto `origin/main` and FF again. Never force-push.
- **Never:** `--no-verify`, resetting existing commits, committing `.env`, `git commit -a` in `banijjik` (picks up `.claude/settings.json`).
- **Docs commits:** `git switch -c s/docs-<slug> origin/main`, commit, `git push origin HEAD:main`.
- Pushing `main` is allowed after green CI (owner 2026-10-23, 2026-10-25, 2026-10-28). Docs-only LEAD-STATE saves are allowed (owner 2026-11-02).

## 6. Session log (last five)
- **2026-11-02** (Cursor Auto, `banijjik-docs`): recorded 4.3 COD S1b merged — code `83d96e85`, R1 PASS `f9b619c4`, CI [41402885747](https://github.com/abdullahboshir/banijjik/actions/runs/41402885747) success, JS budget still 180; `origin/main` `eb6e1d9e`; S1c starting from that SHA on `s/4.3-cod-s1c-order-delivery`; S1d/S1e/4.4 not started; OQ-4/OQ-5 unanswered. Did not edit STATUS or the S1c worktree.
- **2026-11-02** (Cursor Auto, `banijjik-docs`): FF `origin/main` to `38d5b01e` with `docs/plans/4.3-4.6-acceptance.md` (docs-only; requested SHA `2290e5c5` was not a git object — real commit is `38d5b01e`). Did not touch COD S1b or 4.4.
- **2026-11-02** (independent R3, `banijjik-4.3-cod-s1a`): JS-budget increment **PASS**; CI [41398058318](https://github.com/abdullahboshir/banijjik/actions/runs/41398058318) green @ `e2a6bcfd`; S1a already on `main`; did not start S1b / 4.4 / V. Handoff `docs/handoffs/4.3-cod-s1a-review-R3.md`.
- **2026-11-02** (Composer, `banijjik-docs`): recorded V0 (`e78083e4`, CI 41389405302), V (join `32bcfa64`, docs `8e67c94d`), and COD S1a (`e2a6bcfd`, R2 `2f46701a`, CI 41398058318) as merged; S1b starting on `s/4.3-cod-s1b-delivery-api` from `6b79757b`; S1e and 4.4 rest not started; OQ-4/OQ-5 unanswered and not blocking S1b.
- **2026-11-01** (Claude Opus 5.5, `banijjik`): found V failed R1 and holds the storefront checkout fixes S1e needs; owner chose to carve them into card 4.3 V0 and planned it (`docs/plans/4.3-V0.md`, `59eae453`); merged `origin/main` into the V branch locally (`c727ebe8`, not pushed).
