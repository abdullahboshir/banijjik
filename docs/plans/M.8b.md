# Plan: card M.8b · Review-result SMS for directory listings

Tier: T2 · Planned by: Opus 5.5 (lead) · Date: 2026-10-25 · Based on commit: `main 5a15d60`

## Session parts
One part, API only (branch `s/M.8b-api-review-sms`). It can start now: it uses the existing `SmsSender` port, so it works with the development `test-inbox` driver today and with the real SMS provider when M.9 plugs one in. Email is out of scope (no email driver exists).

## Goal
When staff approve or reject a customer's listing (or archive it for a final rejection), the customer gets one SMS in the business's language that names the business and the listing number and, for a rejection, the reasons. A retry never sends twice. The business can switch it off.

## Inputs read
- `packages/contracts/src/directory/directory-event-type.ts` (`directory.listing.approved`, `directory.listing.rejected`), `directory-contracts.ts` (`ListingEventPayload { listingId, listingNumber, ownerCustomerAccountId, status }`, `ListingRejection { reasonKeys, note? }`, template `rejectionReasons`)
- `apps/api/src/modules/commerce/contact/application/send-customer-otp-sms.handler.ts` and `infrastructure/sms-senders.ts` (`SmsSender`, `TestInboxSmsSender`, `DisabledSmsSender`), `routes/contact-event-handlers.ts` (`buildOtpMessageComposer`: business default locale, `createTranslator`)
- `docs/16-MATRIMONY-TRACK.md` §5 (M.8) and §6 decision 2 (SMS provider, launch blocked without one)
- ADR-090 (outbox side effects), ADR-119 (customer accounts, never log message text)

## Decisions
1. **Handler in the directory module:** `directory.notifyReviewResult`, UNORDERED, on `directory.listing.approved` and `directory.listing.rejected` (`alsoHandles`). It runs only while the directory module is effective (the handler's `moduleKey`).
2. **Who gets it:** the listing owner's customer account (`ownerCustomerAccountId`) → its phone through a new contact port `CustomerSmsNotifier.sendToCustomer({ customerAccountId, text, dedupeKey })` exported from contact `index.ts`. Contact resolves the phone, refuses a blocked or erased account silently (logged at info with the account id, no text), and sends through the configured `SmsSender`. Directory never sees the phone.
3. **Once only:** `dedupeKey` = `listing-review:<listingId>:<eventId>`. Contact keeps a small `CustomerSmsSent` record (tenancy ORGANIZATION, unique `{ organizationId, dedupeKey }`, `sentAt`, TTL 90 days) written **before** the send in the same unit of work; a duplicate key means the event already sent and nothing is sent again. If the send then throws, the transaction rolls back the record and the event retries.
4. **Text** from i18n keys in the business's default locale (like the OTP composer): `sms.listingApproved` (`{businessName}`, `{listingNumber}`) and `sms.listingRejected` (`{businessName}`, `{listingNumber}`, `{reasons}`). `reasons` = the labels of the rejection's `reasonKeys` from the template's `rejectionReasons` in that locale, joined with ", "; the staff note is **not** sent (it may contain personal remarks). Keep each text within one Bangla SMS where possible; no URL unless the storefront host is known (then add `{siteUrl}` = `https://<slug>.<STOREFRONT_BASE_DOMAIN>/my/listing`).
5. **Switch:** new setting `directory.notifyReviewBySms` (BOOLEAN, default true, no location override), registered by the directory manifest. Off → the handler does nothing.
6. **Driver `disabled`:** when `SMS_DRIVER=disabled`, the notifier does nothing and logs once per event at info (no error, no retry): a business without SMS still reviews listings. (Only OTP fails loudly when disabled, as today.)

## Files
| Path | Create/Change | Owns / add-only | Purpose |
|---|---|---|---|
| `packages/contracts/src/directory/**`, `contact/**` | Change | add-only | setting key, notifier types |
| `packages/i18n` catalogs (`sms.listingApproved`, `sms.listingRejected`, setting label) | Change | add-only | decision 4 |
| `apps/api/src/modules/commerce/directory/**` (handler, manifest setting and handler entry, README) | Change | owns | decisions 1, 4, 5 |
| `apps/api/src/modules/commerce/contact/**` (`CustomerSmsNotifier`, `CustomerSmsSent` model, index export) | Change | owns | decisions 2, 3, 6 |
| `apps/api/src/routes/*event-handlers.ts` (wiring) | Change | add-only | register the handler |
| handoff `docs/handoffs/M.8b.md`, STATUS row M.8 | Change/Create | | |

## Tests (must exist and pass)
- `an approved listing sends one SMS to its owner's phone with the business name and listing number` (test-inbox)
- `a rejected listing sends the reasons in the business language and never the staff note`
- `a second delivery of the same event sends nothing`
- `a failed send rolls back the sent record and the retry sends once`
- `the setting off sends nothing`; `the SMS_DRIVER disabled sends nothing and does not fail the event`
- `a blocked or erased customer account gets no SMS`
- `the handler does nothing while the directory module is off` (generated module-off test)
- `the SMS text is never logged` (logger spy)
- Existing directory, contact and storefront suites green.

## Out of scope
Email; push notifications; SMS for other events (connections, credits); a real SMS provider (M.9).

## Risks & checks
- Cost: one SMS per review result only; the dedupe record prevents double cost on retries.
- Privacy: the text has no personal data of the listing beyond its number.

## Done when
Every test passes, CI green on the branch head, handoff written, `npm run card:check` all PASS.
