# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-10-30 by Antigravity (`banijjik`) · `origin/main` after 4.3 A0, A1 (`be5c8b9c`), A2 (`738b441c`), and A3C (`5308dd0d`).

## 1. Where the project stands
- **Claude plan ends 2026-10-29.** Roles from `docs/RUN-WITHOUT-CLAUDE.md`. Owner still says yes to fast-forward of `main` after green CI.
- Speed: `.cursor/rules/speed.mdc`. No root lint/typecheck/test/build. CI is not a debugger. Docs-only skip CI. Bring a pushed branch up to date with `git merge origin/main` (never rebase, never `--force`). `card:check` INFO when main moved is enough.
- Phase 3 F1–F4 closed. Phase 4 underway.
- **4.1 complete on `main` (`636bcdb9`).**
- **4.2 complete on `main` (A1 + A2C + A2 + A2I + A3 + B + C1 + C2).**
- **4.3 A0, A1, A2, A3C complete.** A1 (`be5c8b9c`), A2 (`738b441c`), and A3C (`5308dd0d`, safe guest contact creation, customer phone isolation, partial unique index preservation) implemented, T1-reviewed and green.
- **4.4 A1 + A1D** on `main` (A1D `fbe1ff65` / `90186f1b`, CI [40869825029](https://github.com/abdullahboshir/banijjik/actions/runs/40869825029)).
- Staging Cloudflare smoke waits on owner credentials (`docs/runbooks/storefront-domains.md`).
- ADR-150: full tenant website (4.1–4.5) before the pilot. ADR-149: each business site has its own design. ADR-P4-B Accepted (proposed).

## 2. Open branches (checked 2026-10-30)

None — 4.3 A1, A2, and A3C landed cleanly.

**Disk / local:** Docker Desktop + Redis 6380. Compose Mongo stays stopped. `gh run watch` drops (TLS); poll `gh run view <id> --json jobs`. Stale `dist` after branch switch: `npx turbo run build --filter=<pkg>`. Owner stack holds 3000/4000.

## 3. Waiting on the owner
- Turn on "Start Docker Desktop when you sign in".
- Product: 3.9 offline selling; M.6 listing `noindex`; keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public).
- Optional: Cloudflare staging credentials for a real A3 smoke (`docs/runbooks/storefront-domains.md`).

## 4. Next actions, in order
1. Implement **4.3 COD-S1** / **4.3 A3S** (`s/4.3-a3s-customer-order`: customer order command), **4.3 A3B** (`s/4.3-a3b-customer-booking`), **4.3 A3P** (`s/4.3-a3p-payment-lifecycle`), and **4.3 A3E** (`s/4.3-a3e-customer-enrollment`) — all frozen in `docs/plans/4.3.md` (`Refresh A3S-A3E`) and `docs/plans/4.3-COD.md` (`Refresh COD-S1`).
2. Implement **4.4 A1A** (`s/4.4-a1a-platform-template-api`: platform template CRUD/validation use cases) from `docs/plans/4.4.md`.
3. Follow-ups (not blocking): 4.3 A1 review leftovers (`docs/handoffs/4.3-a1-review-R1.md`); M.6a review leftovers; M.7 B needs `directory.listing.read`; 3.5b A2 return response lacks `reversal.businessDate`.

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
- **2026-10-30** (Antigravity, `banijjik`): verified 4.3 A1 (`be5c8b9c`), completed T1 review (`4.3-a1-review-R1.md`); completed, T1-reviewed (R1 PASS) and merged 4.3 A2 (`738b441c`, CI 40992400902) and 4.3 A3C (`5308dd0d`, CI 40998523354); froze `Refresh A1-A3C`, `Refresh COD-S1`, and `Refresh A3S-A3E`.
- **2026-10-29** (Antigravity, `banijjik`): implemented, T1-reviewed (R1 PASS) and merged 4.2 C2 (`d6d845e3`, CI 40896729028) and 4.4 A1D (`90186f1b`, CI 40869825029) to `main`; Card 4.2 is 100% complete.
- **2026-10-29** (Antigravity, `banijjik`): fixed 4.2 C1 browser seed + production env, T1 review R1 PASS, green CI (`40866857486`), FF `main` and froze `Refresh C2-1`.
- **2026-10-29** (Cursor, `banijjik-4.2-a2c`): landed 4.2 B (`4167a64b`, CI 40831295349) and 4.4 A1 (`d35e3112`, CI 40835038619).
- **2026-10-29** (Cursor, `banijjik-4.2-a2c`): landed A3 (`3d6d133c`, CI 40820722210) after A2C/A2/A2I.
