# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-10-29 by Antigravity (`banijjik`) · `origin/main` after 4.2 C1 (`e2e74cb1`, CI [40866857486](https://github.com/abdullahboshir/banijjik/actions/runs/40866857486)) and Refresh C2-1 freeze.

## 1. Where the project stands
- **Claude plan ends 2026-10-29.** Roles from `docs/RUN-WITHOUT-CLAUDE.md`. Owner still says yes to fast-forward of `main` after green CI.
- Speed: `.cursor/rules/speed.mdc`. No root lint/typecheck/test/build. CI is not a debugger. Docs-only skip CI. Bring a pushed branch up to date with `git merge origin/main` (never rebase, never `--force`). `card:check` INFO when main moved is enough.
- Phase 3 F1–F4 closed. Phase 4 underway.
- **4.1 complete on `main` (`636bcdb9`).** Owner merge yes; T1 written review skipped to land.
- **4.2 A1 + A2C + A2 + A2I + A3 + B + C1 are on `main`.** C1 code `e2e74cb1`, CI [40866857486](https://github.com/abdullahboshir/banijjik/actions/runs/40866857486). Refresh C2-1 frozen in `docs/plans/4.2.md`.
- Staging Cloudflare smoke waits on owner credentials.
- ADR-150: full tenant website (4.1–4.5) before the pilot. ADR-149: each business site has its own design. ADR-P4-B Accepted (proposed).

## 2. Open branches (checked 2026-10-29)

| Card / part | Branch | Folder | Tier | State → next step |
|---|---|---|---|---|
| 4.2 C2 | `s/4.2-c2-cache-seo` | `banijjik` | T1 | frozen (`Refresh C2-1`); ready to implement |
| 4.4 A1D | `s/4.4-a1d-template-persistence` | `banijjik-4.1-a1` | T1 | T1 review R1 PASS; merge `origin/main` and wait for green CI |

Merged this session: 4.2 C1 `e2e74cb1` → `main` + Refresh C2-1 freeze. Next: implement 4.2 C2 and merge 4.4 A1D.

**Disk / local:** Docker Desktop + Redis 6380. Compose Mongo stays stopped. `gh run watch` drops (TLS); poll `gh run view <id> --json jobs`. Stale `dist` after branch switch: `npx turbo run build --filter=<pkg>`. Owner stack holds 3000/4000.

## 3. Waiting on the owner
- Turn on "Start Docker Desktop when you sign in".
- Product: 3.9 offline selling; M.6 listing `noindex`; keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public).
- Optional: Cloudflare staging credentials for a real A3 smoke (STATUS gap). Not required for C2.

## 4. Next actions, in order
1. Implement **4.2 C2** (`s/4.2-c2-cache-seo`: public cache, SEO metadata, `robots.txt`, `sitemap.xml`, runbook) from `Refresh C2-1`, verify locally, push and merge.
2. Sync `origin/main` into **4.4 A1D** (`s/4.4-a1d-template-persistence`), wait for green CI, and merge.
3. Follow-ups (not blocking): M.6a review leftovers; M.7 B needs `directory.listing.read`; 3.5b A2 return response lacks `reversal.businessDate`.

## 5. How the lead works
- **Role:** plans, T1 reviews, merge checks, fast-forward of `main`. Reply in Bengali script; code/docs in English.
- **Merge:** `git fetch origin && git merge origin/main` on the card branch. STATUS row merged on the branch, commit, push, wait green CI (docs-only uses the last code run). Then `git push origin <branch>:main`. If rejected, main moved: merge again. Never force-push.
- **card:check** must print PASS on every line (INFO about main is fine) before a review or merge.
- **Never:** `--no-verify`, resetting existing commits, committing `.env`, `git commit -a` in `banijjik` (picks up `.claude/settings.json`).
- **Docs commits:** `git switch -c s/docs-<slug> origin/main`, commit, `git push origin HEAD:main`.
- **Local verify:** `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe"` `MONGOMS_VERSION_CHECK=false` `TEST_REDIS_URL=redis://127.0.0.1:6380`. Do not run the root suite.
- **i18n / add-only conflicts:** keep both sides; catalogs join with a comma.
- Pushing `main` is allowed after green CI (owner 2026-10-23, 2026-10-25, 2026-10-28).

## 6. Session log (last five)
- **2026-10-29** (Antigravity, `banijjik`): fixed 4.2 C1 browser seed + production env, T1 review R1 PASS, green CI (`40866857486`), FF `main` and froze `Refresh C2-1`.
- **2026-10-29** (Cursor, `banijjik-4.2-a2c`): landed 4.2 B (`4167a64b`, CI 40831295349) and 4.4 A1 (`d35e3112`, CI 40835038619).
- **2026-10-29** (Cursor, `banijjik-4.2-a2c`): landed A3 (`3d6d133c`, CI 40820722210) after A2C/A2/A2I.
- **2026-10-29** (Cursor, `banijjik-4.2-a2c`): landed A2C, A2 (`ed191a97`, CI 40807305308), A2I (`749bef7d`, CI 40816582956).
- **2026-10-28 afternoon** (Cursor, `banijjik-m2`): ported 4.1 A3+A3D+A3R+A3I onto `s/4.1-a3-publish`, green CI, FF `main` `636bcdb9`.
