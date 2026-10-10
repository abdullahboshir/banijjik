# GitHub setup (owner steps)

Branch protection is a GitHub setting. Apply it by hand once, after the first CI run has finished (GitHub only offers a check in the list after it has run at least once).

## 1. Push and confirm the first run
1. Push `main` (or open the first PR) and open the **Actions** tab.
2. Confirm that workflow **CI** has two jobs, `verify` and `secrets`, and that both are green. Report any failure to the next session. The first run has never been verified by an agent.

## 2. Protect `main`
Settings > Branches > Add branch ruleset (or classic branch protection rule) for `main`:
1. Enable **Require a pull request before merging**.
2. Enable **Require status checks to pass before merging** and add the checks `verify` and `secrets`.
3. Enable **Require branches to be up to date before merging**.
4. Enable **Block force pushes** and **Restrict deletions**.
5. Optional: **Require linear history**.

## 3. What CI checks
- `verify`: `npm ci`, build of the workspace packages (so type-aware lint sees real types), lint, format check, typecheck, test, build, then the audit gate.
  - `npm audit --omit=dev --audit-level=high` **fails** the job (production dependencies).
  - `npm audit --audit-level=high || true` only reports dev-only findings, which do not block merges. The gate is `npm audit --omit=dev --audit-level=high`; dev-only advisories (mostly from `@lhci/cli` and `eslint-plugin-boundaries`, with no non-breaking fix) are reviewed in card 6.3, so this doc keeps no count.
- `secrets`: gitleaks CLI (pinned version and SHA-256) scans only commits **after** baseline `b772501`. Config: `.gitleaks.toml`.

## 4. Owner task P1: old history still holds real secrets
History before commit `61496c1` contains the committed `apps/backend/.env` secrets. CI does not scan that range, so it does not fail, but the secrets are still public in a public repo. Rotate every credential that was in that file, then decide whether to rewrite history.

## 5. Updating pinned actions
Every action in `.github/workflows/ci.yml` is pinned to a full commit SHA with the version in a trailing comment. To update one, look up the tag's SHA (`git ls-remote https://github.com/<owner>/<repo> refs/tags/<tag>`), replace SHA and comment together, and let CI run on the PR. The gitleaks version and SHA-256 are in the `secrets` job `env`; the checksum comes from the release's `*_checksums.txt`.

## 6. Claude Code hook
`.claude/settings.json` registers `scripts/hooks/claude-block-env.mjs` as a `PreToolUse` hook for Edit, Write and NotebookEdit. It blocks agent edits of `.env*` files except `.env.example`. Shell commands are not covered by this hook.
