# M.6c merge check R1 (lead, Opus 5.5, 2026-10-25)

Branch `s/M.6c-ui-storefront-account`, rebased by the lead onto `main 069b48a` (+ `c23db11`). Plan `docs/plans/M.6.md` decisions 15–17 and "Refresh M.6c" (C1–C8). CI 40212461364 green before the rebase. `card:check`: all PASS except "rebased" (fixed by this rebase).

**Verdict: not mergeable yet.** Three plan items are missing. Everything else checked is fine.

## Must fix
1. **C7 browser tests (plan tests, Definition of Done).** Both are missing:
   - storefront: fill the biodata steps, submit, staff approve, unlock, buy credits, report, block, export, and erase asks for the code;
   - admin: edit and publish a page, the storefront shows it, a stale save shows the conflict, staff without the write permission sees it read-only.
   Use the plan's names from the M.6 "Tests" list. Reuse the M.6b helpers (`publishTemplate`, `grantDirectoryModule`, `latestSmsCode` with `sentAfter`, the GEO_BD sample). The stack runs the worker: reload or poll with a deadline, never race it. Docker does not run on this PC, so these suites run on CI only: push and read the CI job logs.
2. **C8 route sizes.** Add the new storefront routes (`/my/listing`, `/my/credits`, `/my/connections`, `/my/account`) to the storefront browser budget test (≤ 170 KiB, measured the way M.6b measures) and the admin `website/pages` route to the admin budget test (≤ 180 KiB). Put the CI-measured numbers in the handoff. The local error-shell number (167.6 KiB) is not a measurement.
3. **Decision 15 photo upload.** When `photoPolicy` is not `NONE`, the biodata form shows the upload field and uses the existing endpoint (LISTING_PHOTO, PRIVATE). Photo display stays out of scope (plan "Out of scope"). Add a unit test: `shows the photo upload only when the photo policy allows it`.

## Accepted
- Deviation 1: `VALIDATION_ERROR` answers 400 in this codebase (`error-code.ts`). The test name says 400. Accepted.
- Deviations 2–6 (draft save maps value errors too, client checks required fields only, no upazila flag, `@banijjik/ids` to dependencies, `@banijjik/ui/markdown` subpath). Accepted.
- Known gaps "clearing an optional field", "rejection reasons as raw keys", "APPROVED listing read-only", "lists refresh on the next visit", "idempotency key per unlock press": accepted as follow-ups. Write each in the STATUS M.6 row. They need API decisions, not code here.

## R2 (lead, 2026-10-26)
All three items are fixed: both C7 browser tests pass on CI; the CI-measured sizes are in the handoff (storefront 151.0–153.8 KiB of 170, admin `website/pages` 169 KiB of 180 after the lazy preview); the photo upload shows only when the policy allows it (`photo-upload.test.ts`). Lead fix at merge: removed a leftover "publish diagnostics" debug write from `website-pages.browser.test.ts`. **Accepted.**
