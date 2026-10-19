# Handoff: card M.1 · IMPLEMENT (T1) · 2026-10-18

- **Branch / commits:** `s/m1-customer-accounts`, rebased on `main a5440e1` (3.1b merged), worked in `banijjik-lead`. Not merged, not pushed. Commits: vocabulary, validation and config `aafaffc` (before the rebase); API `2bb8ccf`; docs `d65f5ea`; admin section `7e071a7`; this handoff.
- **Model:** Claude (Sonnet 5.5) in Claude Code
- **Done:**
  1. **Models** (`commerce/contact`, tenant DB): `CustomerAccount`, `CustomerSession`, `OtpChallenge`, and `SmsTestMessage` for the test inbox. Unique indexes per organization on account contact and phone, session token hash, challenge phone; TTL indexes on session and challenge expiry.
  2. **Sign-in:** `POST …/auth/otp/send` (always 202), `…/otp/verify`, `…/auth/refresh`, `…/auth/logout`, `GET …/me`, public `GET /storefront/resolve?host=`. Own pipeline in `routes/storefront.ts` (per-address limit, ACTIVE organization, tenant context, then the contact router). `contact.customerLogin` switch plus `SMS_DRIVER`: either off gives 404 `errors.storefront_not_available`.
  3. **Tokens:** `kernel/auth` has `createCustomerTokenIssuer`, `createCustomerTokenVerifier` (audience `storefront`, `org` claim), `cacheAccountStatus` (60 s) and `authenticateCustomer`.
  4. **SMS:** event `contact.customerOtp.requested` (challenge id only) → handler `contact.sendCustomerOtp` → `SmsSender` port (`test-inbox`, `disabled`). The code is sealed (AES-256-GCM) only for the handler and removed after sending; the worker registers the handler in `start-worker.ts` through `routes/contact-event-handlers.ts`.
  5. **Staff:** `GET/POST …/contacts/{contactId}/customer-account[/block|/unblock]`, permissions `contact.customerAccount.{read,block}` (read: owner, manager, cashier, staff; block: owner, manager), audit and events. Block deletes the sessions in the same transaction.
  6. **Ending a contact** (archive, anonymize) deletes its account and sessions in the same transaction, with an audit entry and an event (`contact.customerAccount.ended`). A customer who comes back signs in again and gets a new account and a new contact.
  6b. **Refresh grace window** (copied from the admin sessions): a replaced refresh token shown again within 10 seconds is refused without ending the session; later it ends it.
  7. **Admin:** "Website login" section on the contact page (status, first and last sign-in, Block or Unblock behind a confirmation). The dialog is loaded on the first tap (route budget).
  8. Docs: ADR-119, `09 §5.2`, `14 §6`, contact README.
- **Tests:**
  - API: `customer-auth-api` (12: flow, cookies, no duplicate contact, rotation, theft, resolve, isolation, switch off), `customer-otp-safety-api` (11: no enumeration, no SMS for blocked, 403 only after right code, limits per phone and address, 5 guesses, expired, used, replaced, code and phone never in logs, outbox, audit, stored challenge or responses, sealed copy cleared), `customer-account-staff-api` (10: view, permissions, cross-org 404, block, unblock, stale version, anonymize and archive end the login).
  - Unit: codec, entity, token, status cache.
  - Admin: `website-login.test.tsx` (6).
  - The secrecy tests first assert that the searched logs, outbox and audit lists are not empty.
- **Verified with** (one heavy command at a time, with the lead's go and the owner's confirmation; unit suites `VITEST_MAX_WORKERS=2`, browser suites 1):
  - `npm run lint`, `npm run format:check`: clean.
  - `npx turbo run build typecheck test --force --env-mode=loose --concurrency=1 --continue`: 28 of 29 tasks on the first run. Four api failures: two `sync-indexes` spawned-process tests and the settings key list were **forced by this card** (production now requires `OTP_SECRET` and `STOREFRONT_BASE_DOMAIN`; the new setting `contact.customerLogin` is in the list). Fixed in `spawned-process.ts` and `settings-api.test.ts` with added lines only, no assertion weakened. `ordered-event-worker` ("runs a replayed event again") timed out under load; it passed alone and in the rerun (timing, not touched by this card).
  - api, second full run: **198 files, 1759 passed, 1 skipped**. Other packages (first run): platform 123, admin 426, validation 238, ui 223, web-client 91, contracts 71, i18n 23, ids 14, lint-tests 274.
  - `npm run test:tools`: 274 passed.
  - admin browser: 66 passed, 8 skipped. platform browser: 16 passed, 2 skipped.
  - Route size: the browser budget tests passed (the dialog loads lazily); I did not read the contact route's exact KiB figure.
- **Deviations from plan (to approve):**
  1. `SYSTEM_REASON.STOREFRONT_RESOLVE` was added and then removed: Organization is platform data (tenancy NONE), so the lookup needs no system read and no new bypass file.
  2. Archive and anonymize **delete** the account (the plan said block): the account holds the phone number (erasure), and a blocked leftover would keep the phone unique index and stop a new contact from signing in.
  3. New dependency `@banijjik/i18n` in `apps/api` for the SMS text.
  4. `SMS_DRIVER=disabled` (not in the plan) so production can start before a provider exists.
  5. `Contact.create` takes `createdByUserId: null` for contacts created by sign-in.
- **Not done / known gaps:**
  - No real SMS provider (M.8 or M.9). No browser test of the new section (it needs a seeded customer account in the stack); the unit tests cover it.
  - The queue is not part of the API tests: they run the real handler on the stored outbox events. A live worker test for this handler was not written.
  - The SMS can be sent twice if the worker stops between sending and clearing the sealed code.
  - The `contact.customerLogin` setting has no label in the catalogs (the dedupe setting has none either); check the general settings page.
  - M.6 note: the refresh cookie path is `/api/v1/storefront`; the same-origin proxy must keep the path, and must not forward a browser `Origin` that `CORS_ALLOWED_ORIGINS` does not list (the API refuses it).
- **Noticed outside the card:** none.
- **Lead's decisions (2026-10-18):** deviations 1 to 5 approved. The three notes (refresh path and proxy, double SMS, setting label) are known gaps in STATUS; the proxy note goes to M.6's plan.
