# Plan: card M.1 · Customer accounts and phone OTP sign-in (storefront)

Tier: **T1** (authentication, personal data, SMS cost abuse) · Planned by: Opus 5.5 (Claude) · Implemented by: a Claude Code session · Date: 2026-10-18 · Based on commit: `main 42e9611` + the M.0 approval commit

Track M (`docs/16-MATRIMONY-TRACK.md`, approved 2026-10-18), first card. **Start after card 3.1b is merged** (it builds the contact detail page this card adds a section to). Read `docs/plans/phase-3-lanes.md` and doc 16 first. Reserved ADR number: **ADR-119**.

## Goal
A business's customers sign in to its public site with their phone number and a one-time code. They get their own account, linked to the business's Contact for that phone, so matrimony members, shop customers and booking customers all have one login per business.

The account is **never** a User or a Member (ADR-045):
- its own token audience (`STOREFRONT`) and cookies
- valid only for the organization that issued it

The business decides whether customer sign-in is on. Staff can see a contact's login and block it.

## Inputs read
- ADR-010 (cookies), ADR-045, ADR-048 (sessions), ADR-077 (storefront surface `/api/v1/storefront/orgs/{organizationId}`), ADR-087 (bypass only in routes), ADR-090 (outbox), ADR-110 (contacts, phone-first dedupe), ADR-115 (ordering keys)
- `09 §5.2` (CustomerAccount, CustomerSession), `14 §6` (storefront rows: `GET /storefront/resolve?host=`, `POST /auth/otp/send`, `/auth/otp/verify`, `/auth/logout`), `14` rate-limit rows (auth/OTP per IP and per identifier)
- `10 §5` contact row: `contact.customerAccount.{read, block}`; `15-PORT-MAP` contact CustomerAccount row (manoxen `modules/portal` OTP flow and rate limits: port the logic and tests only)
- Code:
  - `kernel/auth` (verifier, `authenticate`, `TOKEN_AUDIENCE.STOREFRONT`), the iam session and refresh code (pattern only)
  - `kernel/rate-limit`, `kernel/events`, `kernel/tenancy` (`runInOrganizationContext`)
  - `config/*` (validated config, production refusals)
  - `commerce/contact/**`, `routes/v1.ts`, `eslint/scopes.mjs`

## Decisions
**Model** (owner `commerce/contact`, tenant DB, tenancy `ORGANIZATION`)

1. Three collections:

   | Collection | Fields | Rules |
   |---|---|---|
   | `CustomerAccount` | `customerAccountId`, `contactId` (unique), `phoneE164` (unique per organization), `status` (`ACTIVE \| BLOCKED`), `verifiedAt`, `lastLoginAt`, `blockedAt?`, `blockedByUserId?`, `version`, audit fields | |
   | `CustomerSession` | `customerSessionId`, `customerAccountId`, `refreshTokenHash` (SHA-256 of a random 32-byte token), `expiresAt` (30 days, TTL index), `createdAt`, `lastUsedAt`, `userAgentSummary?` | revoked by deletion; refresh rotates the token |
   | `OtpChallenge` | `otpChallengeId`, `phoneE164`, `codeHash` (HMAC-SHA-256 with `OTP_SECRET`), `codeCiphertext` (AES-256-GCM with a key derived from `OTP_SECRET`, only so the SMS handler can send it; cleared right after sending), `attempts`, `expiresAt` (5 minutes, TTL index), `consumedAt?` | |

   - Six-digit codes come from `crypto.randomInt`. Code comparison is constant time.

**Organization switch**

2. A new setting `contact.customerLogin` (BOOLEAN, default false, client-visible, organization level) on the contact manifest. The 2.7b general settings page shows it automatically. While it is off, every customer auth endpoint answers 404 `errors.storefront_not_available`.

**Storefront surface** (mounted once in `routes/v1.ts` through a new `routes/storefront.ts`; add that file to the allowed `runInOrganizationContext` files in `eslint/scopes.mjs`)

3. Endpoints:

   | Endpoint | Notes |
   |---|---|
   | `GET /api/v1/storefront/resolve?host=` (public) | Maps `<slug>.<STOREFRONT_BASE_DOMAIN>` to `{ organizationId }` for an ACTIVE organization; anything else 404. Custom domains come with 4.2. The organization lookup is a system read with a new reason `SYSTEM_REASON.STOREFRONT_RESOLVE` in one use-case file |
   | storefront pipeline for `/api/v1/storefront/orgs/:organizationId/*` | Check the organization exists and is ACTIVE (the same system read), then run the rest in its organization context (`runInOrganizationContext`). Per-IP rate limit for the whole surface |

**Sign-in flow** (all under `/api/v1/storefront/orgs/{organizationId}`)

4. `POST /auth/otp/send { phone }`: always answers `202 { expiresInSeconds }` for a valid phone, whether or not an account exists, so phone numbers cannot be enumerated.
   - It creates a challenge and publishes `contact.customerOtp.requested { otpChallengeId }` (ids only, `orderingKey: otp:<otpChallengeId>` not needed).
   - **Limits:** 3 sends per phone per 15 minutes; 10 per IP per hour; a new send for the same phone invalidates the previous challenge. Over a limit → 429 with `retryAfterSeconds`.
   - A BLOCKED account's phone gets the same 202 and no SMS (no enumeration, no cost).

5. **SMS through the outbox.** A handler in contact (`contact.sendCustomerOtp`, UNORDERED):
   - decrypts the code, calls the **`SmsSender` port**, then clears `codeCiphertext`
   - the message text is an i18n key in the organization's default language, with the business name and the code
   - **Drivers** (validated config `SMS_DRIVER`):
     - `test-inbox` (development and tests): writes `{ phoneE164, text }` to a `sms_test_messages` collection that tests read; never logs the code
     - a real provider adapter comes with M.8 / M.9 once the owner chooses one
   - Production refuses `test-inbox`, so launch needs a provider (doc 16 §6 decision 2).
   - **Never log a code or a full phone number.**

6. `POST /auth/otp/verify { phone, code }`:
   - **Failures:** a wrong code increments `attempts` (max 5, then the challenge is dead); a wrong, expired or used code is `400 errors.otp_invalid` (one key for all, no hint which). Per-IP verify limit: 20 per hour.
   - **On success:**
     1. Consume the challenge.
     2. Find the ACTIVE contact with that phone (3.1a dedupe rule), or create one: role `CUSTOMER`, source `STOREFRONT`; a new `CONTACT_SOURCE` value.
     3. Find or create the `CustomerAccount`: `verifiedAt` on first sign-in, `lastLoginAt` every time.
     4. Create a session.
     5. Set the cookies.

     All of this happens in one transaction. A BLOCKED account → 403 `errors.customer_account_blocked` (only after a correct code, so it reveals nothing to a stranger).
   - **Cookies** (names in contracts, distinct from the admin ones):
     - `sf_access`: JWT, audience `STOREFRONT`, `sub` = customerAccountId, `org` = organizationId, 15 minutes
     - `sf_refresh`: the session token, 30 days, path limited to the auth routes
     - Both httpOnly, Secure (except local development), SameSite=Lax, host-only.

     The storefront app (M.6) calls the API through its own origin (a same-origin proxy), so host-only cookies work on any business domain; record this in ADR-119.

7. **Session endpoints:**
   - `POST /auth/refresh`: rotates the session token; a reused old token revokes the session (theft detection, as the admin refresh does).
   - `POST /auth/logout`: deletes the session and clears the cookies.
   - `GET /me` (customer): `{ customerAccountId, contactId, phoneE164, name? }`.

8. **`authenticateCustomer` middleware** (kernel/auth, beside `authenticate`) puts `customerAccountId` in the request context:
   - the token audience must be STOREFRONT
   - **`org` must equal the path's organizationId**, so an account of business A is rejected at business B with 401
   - the account must still be ACTIVE: a cached check, at most 60 s stale, so a block takes effect within a minute
   - Admin routes keep rejecting storefront tokens and storefront routes reject admin tokens (audience). Test both directions.

**Staff side** (`/api/v1/orgs/{organizationId}`, tenant pipeline)

9. Staff endpoints:
   - `GET /contacts/{contactId}/customer-account` (`contact.customerAccount.read`): `{ status, verifiedAt, lastLoginAt }` or 404
   - `POST /contacts/{contactId}/customer-account/block` and `/unblock` (`contact.customerAccount.block`, with `version`): block deletes all the account's sessions in the same transaction; audited; events `contact.customerAccount.{blocked, unblocked}`
   - **Grants** (add-only): OWNER and MANAGER read and block; CASHIER and STAFF read.
   - **Admin UI:** a "Website login" section on the 3.1b contact detail page (status, last login, Block or Unblock with confirmation) behind those permissions.
   - Anonymizing a contact (3.1a) also blocks its account and deletes its sessions.

**Config** (validated; never logged)

10. New settings:
    - `OTP_SECRET`: at least 32 bytes; production refuses a missing or short one
    - `SMS_DRIVER`: `test-inbox` only outside production
    - `STOREFRONT_BASE_DOMAIN`
    - `.env.example` lines, commented

**Records**

11. ADR-119 ("Accepted (proposed)"):
    - the three collections
    - no enumeration on send
    - limits
    - the code sealed for the SMS handler and cleared
    - the cookies and the same-origin proxy rule
    - `authenticateCustomer` with the organization claim
    - the `contact.customerLogin` switch
    - block semantics

    Also `09 §5.2` (`OtpChallenge`, session fields), `14 §6` rows, the contact README, STATUS row M.1.

## Files
| Path | Change |
|---|---|
| `packages/contracts` (`@banijjik/contracts/contact`: account and session types, cookie names, statuses, events, message keys, `CONTACT_SOURCE.STOREFRONT`; `SYSTEM_REASON.STOREFRONT_RESOLVE` in the root index without adding a line, by extending an existing export) | add-only |
| `packages/validation` (OTP send and verify, block schemas) | create |
| `apps/api/src/modules/commerce/contact/**` (customer-account folder: domain, use cases, OTP, SMS port and test-inbox driver, handler, routers, manifest setting; tests) | create, change |
| `apps/api/src/kernel/auth/**` (`authenticateCustomer`, storefront token issue and verify with the `org` claim) | change |
| `apps/api/src/routes/{v1.ts, storefront.ts}`, `eslint/scopes.mjs`, `core/iam/domain/system-role-grants.ts`, `config/*`, `.env.example` | add-only, change |
| `apps/admin/src/contacts/**` (Website login section) | change |
| `packages/i18n` catalogs | add-only |
| `docs/04-DECISIONS.md` (ADR-119), `docs/09`, `docs/14`, `docs/handoffs/M.1.md`, `docs/STATUS.md` | |

## Tests (must exist and pass)
- [ ] **Happy path:**
  - send → the test inbox has one SMS with a 6-digit code
  - verify sets both cookies, creates the contact (CUSTOMER, STOREFRONT) and the account
  - `/me` works
  - refresh rotates
  - logout clears
  - a second sign-in reuses the account and links the existing contact found by phone (no duplicate contact)
- [ ] **No enumeration:** send for an unknown phone and for a known phone answer the same 202; a blocked phone gets 202 and no SMS.
- [ ] **Limits:**
  - the 4th send for one phone within 15 minutes → 429
  - the IP limit
  - the 6th wrong code kills the challenge
  - an expired code
  - a used code
  - a code from a replaced challenge
- [ ] **Code secrecy:** the code is never in logs, events, outbox payloads or API responses (search the captured logs and the outbox in the test); `codeCiphertext` is cleared after the handler sends.
- [ ] **Isolation:**
  - an account of organization A at organization B → 401
  - an admin token on a storefront route → 401
  - a storefront token on an admin route → 401
  - `customerLogin` off → 404 on every customer auth route
- [ ] **Block:** blocking deletes sessions; the next request with the old access token fails within the cache window (test with a short window); a blocked account's correct code → 403; unblock restores sign-in; permission denied for VIEWER; cross-org 404.
- [ ] **Anonymize** a contact → its account blocked and sessions gone.
- [ ] **Refresh reuse** (theft) revokes the session.
- [ ] **Config:** production refuses `test-inbox`, a short `OTP_SECRET` and a missing base domain.
- [ ] **Admin:** unit tests for the Website login section; the admin browser suite stays green.
- [ ] Every existing suite green; full "Done means" list.

## Out of scope
- The storefront app and its pages (M.6)
- A real SMS provider (with M.8 / M.9)
- Password or email login
- Custom domains (4.2)
- Guest checkout

## Risks & checks
- **SMS cost abuse** is the main business risk: the limits and the no-SMS-for-blocked rule are tested, not assumed.
- **Do not reuse the admin cookie names or the admin verifier without the audience and organization checks.**
- Stop and ask if the iam refresh code cannot be reused by pattern without copying its admin-only assumptions.

## Done when
- A customer of a business with customer sign-in on can sign in by phone code, stay signed in, and sign out, isolated to that business.
- Staff can see and block the login.
- No code or phone leaks to logs.
- The Opus review passes.
