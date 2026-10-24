# Handoff: card M.7 part A2 (listing blocks, account erasure, own-data export, API) · IMPLEMENT · 2026-10-24

- **Branch:** `s/M.7-api-erasure`, rebased on `origin/main` `247f4d4c`. Code commits: `d613864f`..`4b7d8cb3` (first session, another tool) and the review/fix commit on top (second session, this one).
- **Model:** Claude Sonnet 5.5 (Claude Code) for the second session.
- **Plan:** `docs/plans/M.7.md` Part A2 decisions 9–11 and "Refresh A2" (decisions 13–17), which overrides older text.
- **CI:** [run 40088929901](https://github.com/abdullahboshir/banijjik/actions/runs/40088929901) green (verify, browser, secrets) on the code head. The first run, 40088077867, failed only at the directory README line limit (32 > 30), fixed in the next commit.

## Done
- **Contracts / validation / ids / i18n:** `CUSTOMER_OTP_PURPOSE` (`SIGN_IN | ERASE_ACCOUNT`), `CUSTOMER_DATA_EXPORT_SECTION_KEY`, `CUSTOMER_DATA_EXPORT_MAX_ROWS` (1000) and `CUSTOMER_DATA_EXPORT_RULES` (3 per day), the export section/response types, `CustomerEraseResponse`, `CustomerEraseOtpSendResponse`, audit `CUSTOMER_ACCOUNT_ERASED`, event `contact.customerAccount.erased`, `DIRECTORY_SAFETY_RULES.blocksPerAccountMax` (500), `ListingBlockResponse`, two block error keys; `customerAccountEraseRequestSchema`, `listingBlockCreateRequestSchema`; `ListingBlockId`; BN/EN texts (`sms.customerOtpErase`, block errors).
- **Contact:** `OtpChallenge.purpose` (schema default `SIGN_IN`, no migration); `SendCustomerEraseOtpUseCase` (to the account's own phone, no body, same per-phone and per-IP limits); `EraseOwnCustomerAccountUseCase` (reserve a guess by challenge id and purpose, compare, then in one transaction consume, run participants, anonymize the contact, delete account and sessions, audit, event); `ExportCustomerDataUseCase`; ports `CustomerErasureParticipant` / `CustomerDataExportParticipant` (`application/ports/customer-participants.ts`, exported from `index.ts`); routes `POST /my/account/erase/otp`, `POST /my/account/erase`, `GET /my/data-export` (3 per account per day, kernel limiter keyed by `customerAccountId`); SMS text per purpose in `routes/contact-event-handlers.ts`.
- **Directory:** `ListingBlock` (domain, schema `listing_blocks`, repository, use cases, routes `POST/GET /my/listing-blocks`, `DELETE /my/listing-blocks/:listingNumber`), search exclusion (one indexed read of at most 500 ids, `$nin`), `buildDirectoryErasureParticipant()` and `buildDirectoryExportParticipants()` (sections `LISTING`, `DIRECTORY_ACTIVITY`), the settings/template/field adapters moved to `directory-adapters.ts` (index.ts was at the line cap).
- **Credit:** `buildCreditErasureParticipant()` (cancels PENDING purchases with audit and event per purchase, returns the balance forfeited) and `buildCreditExportParticipant()` (section `CREDIT`).
- **Wiring:** `routes/storefront.ts` builds both participant lists next to the other builders.
- **Docs:** ADR-134 amendment, `docs/16` erasure note (principle 3) and blocks line, READMEs of contact, directory and credit.

## Changed from the first session's commits (review fixes)
1. **Ports moved from `@banijjik/contracts` to `contact/application/ports/customer-participants.ts`** with branded ids (the plan wrote branded ids; contracts do not depend on `@banijjik/ids`). `eraseForAccount` now returns a required `{ forfeitedCredits }` (directory returns 0) instead of `{...} | void` with a runtime type check.
2. **Export types without casts:** `ListingExportSection.listing` is a `ListingResponse` (no `as unknown as Record`); the response carries only `sections` (the duplicate top-level `listing` / `directoryActivity` / `credit` keys are gone); the use case picks each section with a typed `requireSection` and throws if a participant is missing, instead of casting and silently substituting empty sections (guide 19, 20). Credit export no longer re-converts ISO strings (`typeof` / `as Date` branches removed); section keys come from the contract constant.
3. **`OtpChallenge.purpose` typed** in the schema (enum, default `SIGN_IN`) and read without a cast; the sign-in `reserveGuess` query now leaves `ERASE_ACCOUNT` challenges untouched, so a sign-in guess cannot burn an erase code's attempts (the post-check in verify stays).
4. **Block cap race:** was count-then-insert; now insert-then-count, and the new row is deleted when the count passes 500, so parallel requests cannot leave more than 500. Duplicate-key detection uses the kernel `isDuplicateKeyError`. The page query sorts by `createdAt` then `listingBlockId` so a page boundary never repeats a row.
5. **`OtpMessageComposer.compose(code, purpose)`**: purpose is required (was optional).
6. **Use cases narrowed with `Pick<...>`** (erase, send-erase-otp, export) so the rollback test needs no `as never` casts; the erase use case was split into small methods (lint limit) and skips `anonymize()` for an already anonymized contact.
7. **Tests rewritten where the name promised more than the body:** the sign-in/erase refusal used a random challenge id and the expired-challenge test passed because of the earlier wrong code (the first draft expired a challenge against the wall clock, not the test clock). All erase-code tests now use real challenge ids and check the stored attempts and purpose. Added: used challenge, own-phone/body-ignored, contact anonymized fields, event without phone or name, 1001-row truncation (blocks and credit entries), another account's data absent, paged block list, rollback then success with the same code.
8. Directory README trimmed to the 30-line module rule.

## Review R1 fixes (lead review of `88ff26a3`)
1. **Export of staff-only contact fields:** `ExportCustomerDataUseCase` reads the effective contact field definitions through the required `contactFields: ContactCustomFieldReader` (wired in `routes/storefront.ts` with the adapter the tenant router uses) and exports only values whose definition has `visibility.storefront === true`; keys with no definition are dropped.
2. **Rollback test:** the participant now deletes the account's sessions and anonymizes the contact, then throws; the test asserts sessions are back, the contact is not anonymized, the account exists and the challenge is unconsumed, then the same code works.
3. **Block duplicate race:** `ListingBlockRepository.insert` returns `{ block, created }`; when the unique index reports a duplicate the use case answers the existing row with `created: false` and skips the cap check, so it cannot delete the older row. The route answers 201 for a new block and 200 for an existing one (the first test now expects 201).

## Verified with (real output)
- `npx tsc --noEmit` in `apps/api`: no output. eslint over every file changed against `origin/main`: no output. prettier check on the same files: `All matched files use Prettier code style!`.
- `apps/api`: `src/modules/commerce/contact` plus `src/modules/commerce/directory/presentation`: `Test Files 14 passed (14)`, `Tests 148 passed (148)` (before the last README trim and rebase); `src/modules/commerce/credit` plus `module-contracts.test.ts` and `module-registry-contracts.test.ts` pass (module-contracts 59/59 after the README trim).
- `packages/contracts` after the rebase: `Tests 76 passed (76)`; `packages/validation` and `packages/i18n` pass.
- CI runs the complete suite, build and browser jobs.

## Tests (names)
`listing-block-api.test.ts` (6): `blocks a listing, is idempotent on duplicate, and lists blocks` (also unblock 204 twice); `lists blocks newest first, one page at a time`; `signed-in search excludes blocked listing, detail still opens, public search unaffected`; `blocking own listing returns 422`; `cross-org listing returns 404`; `501st block returns 409`.

`customer-erasure-and-export-api.test.ts` (15): *Erase Code & Challenge Validation* `refuses a sign-in code for erase and an erase code for sign-in`; `counts a wrong erase code as an attempt and keeps the right code usable`; `refuses an expired erase challenge and a used one`; `sends the erase code only to the account's own phone and ignores a body`. *Erase Execution Happy Path* `answers 200 with the forfeited balance and refuses the old cookie afterwards`; `deletes the account and its sessions and anonymizes the contact`; `archives the listing with its personal data cleared`; `deletes the blocks and open reports it filed and keeps the reports against its listing`; `cancels the pending purchase and keeps the credit entries`; `writes one audit row and one event with ids only, no phone or name`. *Personal Data Export* `exports profile, listing, directory activity and credit sections without _id or secrets`; `cuts a list at the row cap and flags it truncated`; `cuts the credit entries at the row cap and flags the section truncated`; `never shows another account's blocks, reports or phone`; `enforces maxExportsPerDay rate limit (4th export returns 429)`. *Module-Off Resilience & Cross-Org Isolation* `runs erasure when directory is off and exports credits when credit is off`; `rejects unauthenticated requests with 401 and cross-org access with 401`.

`customer-erasure-rollback.test.ts` (1): `rolls back all changes and keeps OTP challenge valid if a participant throws` (then the same code succeeds with a working participant).

Plan list mapping: blocks (all in the first file; the "block again 200 same row" and the unblock cases are in the first test); erase code (4); erase (6 + rollback); export (5); module off (1); permission and tenancy (last test plus `cross-org listing returns 404`).

R1 tests added: `exports only the contact fields visible on the storefront`; `answers one 201 and one 200 and stores one row for two parallel identical blocks`; the rollback test name is unchanged but now proves written data is undone.

## T1 self-review (guide §11)
| # | Item | Where |
|---|---|---|
| 1 | Balance changes write a ledger entry; results checked | n/a: the erase changes no balance. The forfeited balance stays on the erased account id and ledger entries stay (doc 16 principle 3); only PENDING purchases are cancelled (no ledger effect) — `cancels the pending purchase and keeps the credit entries` |
| 2 | Limits inside the transaction; double action stopped by a unique index | Parallel identical blocks: `answers one 201 and one 200 and stores one row for two parallel identical blocks`; Challenge consume is one conditional update (`consumedAt` not set) inside the erase transaction: `refuses an expired erase challenge and a used one`; block uniqueness is the unique index `{organizationId, customerAccountId, listingId}`, a repeat returns the existing row: `blocks a listing, is idempotent on duplicate…`; the 500 cap is insert-then-count with removal (fails closed): `501st block returns 409` |
| 3 | Currency compared, never assumed | n/a: only credit counts, no money amounts |
| 4 | Percentage clamped | n/a |
| 5 | Reversals undo everything | n/a: no reversal; erasure is idempotent per participant (a second call finds nothing) |
| 6 | Versions, 409 on stale, repositories rethrow unknown errors | The contact update uses the `version` read in the same transaction (`contacts.update(contact, contact.version, null)`); the block insert rethrows anything but a duplicate key; credit cancel uses `updateVersioned` |
| 7 | Replay of creating POSTs | Block POST is idempotent by the unique index (200 with the same row); erase and export create no money or stock, the erase is single-use by the consumed challenge: `refuses an expired erase challenge and a used one` |
| 8–10 | Jobs | n/a: no scheduled job in this part |
| 11 | Every state has a way out | An `ERASE_ACCOUNT` challenge leaves by consume, expiry (5 minutes) or replacement by the next send for the phone; an account's blocks leave by unblock or erasure: `sends the erase code only to the account's own phone…`, `deletes the blocks and open reports it filed…` |
| 12 | Settings in jobs | n/a |
| 13–14 | Business date, fixed clock | n/a: no business date. The export limit is a rolling 24 h window (`windowSeconds: 86400`) as the plan says "3 per account per day: the kernel limiter"; tests use the harness clock |
| 15 | `$regex` input | n/a: none added |
| 16 | No secret stored, logged, returned | OTP codes stay hashed and sealed as in sign-in; the export has no hash, token or `_id`: `exports profile, listing, directory activity and credit sections without _id or secrets` (checks `codeHash`, `passwordHash`, `"_id"`) |
| 17 | Permission keys, not roles | n/a: customer routes; the customer must be authenticated: `rejects unauthenticated requests with 401…` |
| 18 | Location-owned data | n/a: blocks and export are organization-scoped (tenant plugin, org-scoped model); cross-organization: `cross-org listing returns 404`, `never shows another account's blocks, reports or phone` |
| 19 | No casts in production; narrow deps with `Pick` | Removed `as unknown as Record`, the `as Date` / `as CustomerOtpPurpose` casts and the section casts; use cases take `Pick<CustomerAuthDependencies, …>`; grep over the A2 production diff finds none |
| 20 | No optional dependency that changes behaviour | `erasureParticipants`, `exportParticipants` required; `compose(code, purpose)` purpose required; a missing export participant throws instead of an empty section |
| 21 | Names from contracts | Section keys, purposes, audit action, event type, rules and error keys come from `@banijjik/contracts`; no runtime-built names |
| 22 | Audit fields, `version`, indexes with `organizationId`; no literals in validation | `listing-block.schema.ts` (audit fields, `version`, both indexes start with `organizationId`); schemas use no message literals |
| 23 | Other modules only through `index.ts`; no infrastructure class exported | Directory and credit import the ports from `contact/index.ts`; `routes/storefront.ts` takes the participants from the three `index.ts` files |
| 24 | Plan tests exist; docs match | The rollback test now writes before it throws (`rolls back all changes and keeps OTP challenge valid if a participant throws`); contact field visibility: `exports only the contact fields visible on the storefront`; See the mapping above; ADR-134 amendment, doc 16 note and READMEs match the code |

## Not done / known gaps
- The forfeited credit balance stays as a balance row on the erased account id (no forfeit ledger entry). The plan keeps entries as they are and only reports the number; if finance wants the balance zeroed with an EXPIRE-style entry, that is a plan decision.
- The contact export lists `customFields` as stored; a sensitive custom field stored sealed would appear in its stored form.
- The M.6 confirmation page that says the balance is forfeited is not part of this API part.
- Block routes carry no rate limit of their own (the cap and the authentication bound them).
- Part B (admin report screens) is separate.
