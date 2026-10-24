# Review R1: card M.7 Part A2 (blocks, erasure, data export) · T1 · 2026-10-24

- **Reviewer:** Opus 5.5 (lead)
- **Branch / head reviewed:** `s/M.7-api-erasure` at `88ff26a3`
- **Against:** `docs/plans/M.7.md` decisions 9–11 and "Refresh A2" (13–17), `AGENTS.md`, guide §11
- **Verdict:** changes requested (three small items). No blocker in the erase transaction, the OTP purpose split, the participants or the tenancy wiring.

## What holds
- Erase code purpose: sign-in `reserveGuess` skips `ERASE_ACCOUNT` challenges, sign-in verify refuses another purpose, erase uses `reserveGuessById` with phone and purpose. A wrong guess costs an attempt outside the transaction; the consume is inside it (decision 17).
- Erase order inside one `unitOfWork.run`: consume, directory, credit, contact anonymize with the version read in the transaction, end login, audit and event with ids only. Cookies cleared in the controller.
- Directory participant archives any non-archived listing (`ACTIVE_STATUSES` includes `HIDDEN` and `REJECTED`), so a staff-hidden listing is erased too. Filed blocks and OPEN filed reports deleted; reports against the listing stay.
- Credit participant cancels PENDING purchases with audit and event; `updateVersioned` throws on a stale version.
- Block cap insert-then-count fails closed under parallel requests. Indexes start with `organizationId`. Search exclusion is one bounded indexed read.
- Rate limits: erase OTP send per IP and per phone, erase per IP, export 3 per account per day.

## Findings (fix all three)
1. **Export returns staff-only contact fields** (`export-customer-data.use-case.ts`, `toContactExport`). `customFields: contact.customFields` exports every stored value, including fields whose definition has `visibility.storefront: false` (staff-only fields such as internal notes or a risk flag). Refresh A2 decision 15 says "the contact's fields. No `_id`, no internal field". Fix: read the organization's effective contact field definitions (the `ContactCustomFieldReader` contact already has) and export only the values whose definition has `visibility.storefront === true`; drop keys with no definition. Test: `exports only the contact fields visible on the storefront` (one storefront field kept, one admin-only field and one undefined key absent).
2. **The rollback test does not prove a rollback of written data** (`customer-erasure-rollback.test.ts`). The failing participant throws before anything is written, so only the challenge consume is checked. The name promises "all changes" (guide §11 item 24). Fix: put a participant that writes first (the real directory participant with a listing, or a participant that inserts a block row) before the throwing one, and assert after the failure that the listing is not ARCHIVED (or the row is absent), the account and sessions exist and the contact is not anonymized. Keep the "same code works afterwards" part.
3. **Block duplicate race returns `created: true` and can remove the older row** (`listing-block.use-cases.ts`, `mongo-listing-block.repository.ts` `insert`). When two identical block requests race, the loser's `insert` catches the duplicate key and returns the existing row, the use case answers `created: true` (201 instead of 200), and if the account is over the cap at that moment the cap branch deletes the existing row, which was not created by this request. Fix: let `insert` report whether it created the row (for example `{ block, created }`), skip the cap check when it did not, and answer 200 with `created: false`. Test: two parallel identical POSTs give one 201 and one 200 and one row.

## Handoff
- Replace `CI_LINK_PLACEHOLDER` with the green CI run of the final head.
- Add the three test names above to "Tests" and to the §11 table (items 2 and 24).
