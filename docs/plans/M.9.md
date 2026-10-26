# Plan: card M.9 · Owner's matrimony site live

Tier: Part A1 T1 (SMS gateways: encrypted credentials, cost, customer sign-in) · Part A2 T2 (settings screens) · Part B ops (owner and lead, no implementer session) · Planned by: Opus 5.5 (lead) · Date: 2026-10-25 · **Refresh A (2026-10-25, owner decisions below)** · Based on commit: `main ee8e6a1`

## Owner decisions
| # | Decision | State |
|---|---|---|
| 2 | **SMS providers** (P5): **adaReach** (mobireach API) and **BulkSMSBD**, both supported. They are set **from settings**, not from `.env`: the platform admin sets a default gateway for every business, and a business may set its own account, which then wins (owner, 2026-10-25, like manoxen). **One provider is active per scope**; the other's details may be stored, but there is no automatic failover. | decided |
| 6 | Site name and domain (or a platform subdomain at first) | open, blocks Part B 7–8 |
| 7 | Legal review of personal-data handling (consents, erasure, export, retention) | open, blocks going live |
| — | Hosting: where the API, worker, storefront and admin run, and MongoDB and Redis | open, blocks Part B |

## Session parts
| Part | Branch | Tier | Starts |
|---|---|---|---|
| **A1** SMS gateways (API) | `s/M.9-api-sms-gateways` | T1, strict review | now |
| **A2** SMS settings screens (admin + platform) | `s/M.9-ui-sms-settings` | T2 | after A1 merges |
| **B** go-live checklist | none (owner with the lead) | ops | after A1, A2, M.6c merge and the legal review |

## Goal
A business's customers get their sign-in code and review-result SMS through a real Bangladeshi gateway. The platform admin enters one default adaReach or BulkSMSBD account in the platform panel; a business can enter its own account in its settings and then pays its own SMS cost. Passwords and API keys are stored encrypted and are never shown or logged again. Every send is logged (without the text), a daily cap and the package's `smsPerMonth` protect the platform's cost, and a "send a test SMS" button proves a setup works.

## Inputs read
- manoxen (reference only, logic not structure): `apps/backend/src/contexts/platform/communication/infrastructure/adapters/ada-reach.adapter.ts`, `bulk-sms-bd.adapter.ts`, `application/lib/ada-reach-errors.lib.ts`, `bulk-sms-bd-errors.lib.ts`, `resolve-sms-gateway.lib.ts`, `merge-sms-integration-patch.lib.ts`. Known faults there that must **not** be ported: plain-text passwords and keys in organization settings, BulkSMSBD over `http://` with the key in the query string, `any` everywhere, empty `catch`.
- banijjik: `commerce/contact` (`SmsSender` port in `application/ports/customer-account-ports.ts`, `infrastructure/sms-senders.ts`, `customer-sms-notifier.ts`, `application/send-customer-otp-sms.handler.ts`, `application/customer-otp-codec.ts` AES-256-GCM pattern), `config/env.schema.ts` (`SMS_DRIVERS`, `smsDriverRule`), `config/read-storefront-config.ts`, `kernel/events/handler-runner.ts` (handlers run inside `runInOrganizationContext`), `kernel/access/limit-guard.ts`, `kernel/rate-limit`, `contracts/entitlement/limit-key.ts` (`SMS_PER_MONTH`, seeded 100–300), `contracts/modules/module-key.ts` (`SMS: "sms"`, CORE), `contracts/platform/platform-permission.ts`, `docs/10-MODULE-CATALOG.md` row `sms` (`integration/sms`).

## Decisions — Part A1
1. **Module** `integration/sms` at `apps/api/src/modules/integration/sms/` (the catalog's place; first module of the `integration/` group), key `MODULE_KEY.SMS`, class CORE (in every package), `tenantCanDisable: false`, with `module.manifest.ts`, `index.ts` and `README.md` in the existing module template.
2. **Encrypted credentials (new ADR-147, reusable by 5.1 couriers):** `kernel/secrets/secret-box.ts` with `sealSecret(plaintext, binding)` and `openSecret(sealed, binding)`. AES-256-GCM, random 12-byte IV, sealed form `v1.<iv>.<tag>.<ciphertext>` (base64url parts). `binding` is the additional authenticated data `"<purpose>:<ownerId>:<field>"` (for example `sms:<organizationId>:adareach.password`, `sms:platform:bulksmsbd.apiKey`), so a sealed value copied into another organization's row does not open. Key from validated config `CREDENTIALS_ENCRYPTION_KEY` (base64 of exactly 32 bytes; required when `NODE_ENV=production`; tests use a fixed test key from `test-support`). A wrong key or a tampered value throws an `INTERNAL` error that names no value. Nothing sealed or opened is ever logged, returned or put in an event or audit change.
3. **Records** (all with audit fields and `version`):
   - `SmsGatewaySetting` — tenant DB, tenancy ORGANIZATION, one row per organization (unique `organizationId`): `smsGatewaySettingId`, `enabled`, `activeProvider: SmsProvider | null`, `adareach: { username, passwordSealed, senderId } | null`, `bulksmsbd: { apiKeySealed, senderId } | null`.
   - `PlatformSmsGateway` — platform DB, tenancy NONE, one row (unique `scopeKey: "DEFAULT"`), same fields with `platformSmsGatewayId`.
   - `SmsLog` — tenant DB, tenancy ORGANIZATION, append-only, one row per send attempt that reached a decision: `smsLogId`, `purpose: SmsPurpose`, `phoneLastDigits` (last 3 digits only: no full number, matrimony privacy), `source: ORGANIZATION | PLATFORM | NONE`, `provider | null`, `outcome: SmsOutcome`, `failureReason: SmsFailureReason | null`, `providerErrorCode: number | null`, `parts: number | null`, `providerMessageId: string | null`, `businessDate` (organization local date), `createdAt`. Never the text (it holds the code). TTL index 180 days on `createdAt`; list index `{ organizationId: 1, createdAt: -1, smsLogId: -1 }`; counting index `{ organizationId: 1, businessDate: 1, outcome: 1, source: 1 }`.
4. **Contracts** (`packages/contracts/src/sms/`, add-only elsewhere): `SMS_PROVIDER = ADAREACH | BULKSMSBD`; `SMS_PURPOSE = CUSTOMER_OTP | LISTING_REVIEW_RESULT | GATEWAY_TEST`; `SMS_SOURCE = ORGANIZATION | PLATFORM | NONE`; `SMS_OUTCOME = SENT | REFUSED | SKIPPED_DAILY_LIMIT | SKIPPED_MONTHLY_LIMIT | NOT_CONFIGURED`; `SMS_FAILURE_REASON = AUTH_FAILED | SENDER_NOT_ALLOWED | BALANCE_LOW | INVALID_NUMBER | NOT_ALLOWED | IP_NOT_WHITELISTED | PROVIDER_REFUSED`; tenant permissions `sms.log.read`, `sms.gateway.read`, `sms.credential.update` (catalog style, like `courier.credential.update`); platform permissions `platform.sms.read`, `platform.sms.write` (`SUPER_ADMIN` both, `SUPPORT` read only, `BILLING` none; write is SUPER_ADMIN only like `package.write`); audit actions `sms.gateway.updated`, `sms.gateway.tested`, `platform.sms_gateway.updated`, `platform.sms_gateway.tested`; setting key `sms.dailyLimit`; rule keys `SMS_GATEWAY_INCOMPLETE`, `SMS_TEST_LIMIT`; error/i18n keys for each failure reason and outcome (BN and EN).
5. **Grants:** OWNER all three tenant keys; MANAGER `sms.gateway.read` and `sms.log.read`; other roles none. Update the contracts count tests.
6. **Which gateway sends** (resolved per send, inside the event's organization context): the organization's row when `enabled`, `activeProvider` set and that provider complete → `ORGANIZATION`; otherwise the platform row under the same rule → `PLATFORM`; otherwise → `NOT_CONFIGURED`. No failover: a refusal by the active provider is final for that message.
7. **`SMS_DRIVER`** becomes `test-inbox | disabled | gateway`. `gateway` = decision 6; production allows `disabled` and `gateway`, refuses `test-inbox` (as today), and requires `CREDENTIALS_ENCRYPTION_KEY` with `gateway`. `contact` builds its `SmsSender` from the sms module's `index.ts` (`buildGatewaySmsSender`) when the driver is `gateway`; `test-inbox` and `disabled` keep their behaviour. The M.8b notifier is the real notifier under `gateway`.
8. **`SmsSender` port** (contact) gains a required `purpose: SmsPurpose`; the OTP handler passes `CUSTOMER_OTP`, the M.8b notifier `LISTING_REVIEW_RESULT`. Contract of `send`: resolves when the message was sent **or permanently refused/skipped** (logged in `SmsLog`, warn log with `smsLogId` and the last 3 digits only); throws only on a transient fault (HTTP 5xx, timeout, network, provider throttling), so the event retries with its backoff and a permanent refusal never loops. The OTP handler and the M.8b notifier stay as they are otherwise (the notifier keeps its dedupe record on a resolved send).
9. **Phones:** stored E.164. Only `+880` numbers are sent; another country is `REFUSED` / `INVALID_NUMBER` without calling the provider. Both providers get `880XXXXXXXXXX` (no `+`).
10. **adaReach driver** (`infrastructure/adareach-sms-driver.ts`): `POST {base}/auth/tokens { username, password }` → `token` (and `refresh_token`); `POST {base}/sms/send` with `Authorization: Bearer`, body `{ sender: senderId, receiver: [msisdn], content: text, msgType: "T", requestType: "S", contentType }` where `contentType` is 2 when the text has any non-ASCII character (Bangla) and 1 otherwise. Success = `status === "SUCCESS"` and `errorCode` 0; `msgCount` → `parts`, `messageId` → `providerMessageId`. Token cached in memory per credential (key = SHA-256 of base + username, never the password) for 55 minutes; one re-login on HTTP 401, then fail. Base URL from config `SMS_ADAREACH_BASE_URL` (default `https://api.mobireach.com.bd`), never from tenant input (no SSRF). Error codes → reasons: 1508, 1501 `AUTH_FAILED`; 1503 `SENDER_NOT_ALLOWED`; 1506 `BALANCE_LOW`; 1202, 1001 `INVALID_NUMBER`; 1509, 1201, 1203, 1204 `NOT_ALLOWED`; 1504, 1505, 1513, 1514 `PROVIDER_REFUSED`; **transient** (throw): 1502 (TPS), 1510, 1512, 1002, HTTP 5xx, timeout.
11. **BulkSMSBD driver** (`infrastructure/bulksmsbd-sms-driver.ts`): `POST {base}/smsapi` as `application/x-www-form-urlencoded` with `api_key`, `type`, `number`, `senderid`, `message` — the key goes in the body, never in a URL. `type` is `unicode` for text with non-ASCII characters and `text` otherwise. Success = `response_code` 202. Base URL from config `SMS_BULKSMSBD_BASE_URL` (default `https://bulksmsbd.net/api`). Error codes → reasons: 1011 `AUTH_FAILED`; 1002, 1005, 1013, 1014, 1015 `SENDER_NOT_ALLOWED`; 1006, 1007 `BALANCE_LOW`; 1001 `INVALID_NUMBER`; 1032 `IP_NOT_WHITELISTED`; 1003, 1012 and any other code `PROVIDER_REFUSED`; **transient**: HTTP 5xx, timeout, network. **If the BulkSMSBD API documentation (https://bulksmsbd.net/api docs page) says POST, HTTPS or `type=unicode` are not supported, stop and ask.**
12. **HTTP:** Node's global `fetch` with an `AbortController` timeout of 10 s; no new dependency. A multi-part message is allowed; its `parts` are logged at info (cost visibility).
13. **Cost guards** (checked before calling the provider, in the organization's local business date and month):
   - `sms.dailyLimit` (INTEGER setting, default 500, not location-overridable, not client-visible): SENT rows of the organization today ≥ limit → `SKIPPED_DAILY_LIMIT`, applies to both sources.
   - `smsPerMonth` (package limit, ADR-050): only for `source PLATFORM` (the platform pays): SENT `PLATFORM` rows this month checked with the entitlement `LimitGuard` → `SKIPPED_MONTHLY_LIMIT`. An organization's own gateway is not limited by the package. **If `LimitGuard` cannot resolve inside a worker handler, stop and ask.**
   - Both counts are a read, not a reservation: parallel workers may overshoot by at most the number of sends in flight. This is accepted for a cost cap (not money in the books); write it in the ADR.
   - `GATEWAY_TEST` sends count in the log but skip both guards; they have their own limit (decision 15).
14. **Tenant API** (routes from the manifest, mounted by the module router; middleware stays in `routes/v1.ts`):
   - `GET /sms/gateway` (`sms.gateway.read`) → `{ enabled, activeProvider, adareach: { username, senderId, hasPassword } | null, bulksmsbd: { senderId, hasApiKey } | null, source: <what decision 6 would pick now>, version, updatedAt }`. Never a secret, never a sealed value.
   - `PUT /sms/gateway` (`sms.credential.update`) body `{ version, enabled, activeProvider, adareach?, bulksmsbd? }` (`packages/validation`): `adareach { username (1–100), password? (1–200), senderId (1–20) }`, `bulksmsbd { apiKey? (1–200), senderId (1–20) }`. An omitted secret keeps the stored one (manoxen merge rule); `null` for a provider block removes it. `enabled: true` with the active provider incomplete → `422 BUSINESS_RULE SMS_GATEWAY_INCOMPLETE`. Stale `version` → 409. Audit `sms.gateway.updated` with the changed field **names** only. Upsert of the single row (unique index; a concurrent first save → 409, not a duplicate).
   - `POST /sms/gateway/test` (`sms.credential.update`) `{ phoneE164 }` → `{ outcome, failureReason, providerErrorCode, source, provider }`: sends the i18n text `sms.test_message` (business locale, business name) through decision 6 now (inline, not through the outbox: it is the admin's own explicit action and its answer is the point; the ADR records this exception to "side effects through the outbox"). Limit 5 per organization per hour (existing rate limiter, `429 RATE_LIMITED` → rule `SMS_TEST_LIMIT`). Logged with purpose `GATEWAY_TEST`; audit `sms.gateway.tested` without the phone. A transient fault answers `502` with `failureReason: null`.
   - `GET /sms/logs?outcome=&from=&to=&cursor=&limit=` (`sms.log.read`), keyset pagination, limit ≤ 100, `lean()` + projection.
15. **Platform API** (`routes/platform.ts` already mounts `authenticatePlatform`): `GET /platform/sms-gateway` (`platform.sms.read`), `PUT /platform/sms-gateway` (`platform.sms.write`), `POST /platform/sms-gateway/test` (`platform.sms.write`, 5 per hour per operator) with the same shapes as the tenant routes; audits in the platform audit log. The platform test logs nothing in any tenant's `SmsLog` (no organization): it answers only.
16. **Docs:** ADR-147 (decisions 2, 6, 8, 13, 14 test exception), catalog row `sms` (permissions, setting `sms.dailyLimit` replaces `sms.senderId`), `apps/api/.env.example` placeholders for `CREDENTIALS_ENCRYPTION_KEY`, `SMS_ADAREACH_BASE_URL`, `SMS_BULKSMSBD_BASE_URL` (no real values), module README.

## Decisions — Part A2 (screens)
17. **Admin:** a "SMS" topic on the settings home (`settings-home/settings-topics.ts`, needs `sms.gateway.read`) → page `settings-sms`: enable switch; provider choice (adaReach / BulkSMSBD); the active provider's fields (adaReach: username, password, sender/masking; BulkSMSBD: API key, sender ID); a stored secret shows "saved" and an empty field keeps it; Save (version, 409 → reload message); "Send a test SMS" with a phone field and the outcome in words (one message per failure reason); a line that says which gateway sends now ("your own account" / "the platform's account" / "not set up"); the last sends (`/sms/logs`, card list on mobile: time, purpose, last digits, outcome). Read-only for `sms.gateway.read` without `sms.credential.update`.
18. **Platform panel:** page `sms-gateway` with the same form and test button for the default gateway; menu entry for `platform.sms.read`.
19. BN and EN keys for every label, outcome and failure reason; mobile-first, touch targets ≥ 44 px; route size within the app's budget.

**Amendment A2-1 (lead, 2026-10-26, after A1 merged):**
- Decision 17: the admin page is **not** added in `settings-home/settings-topics.ts`. Settings topics come from manifest menu entries (ADR-112). Add one menu entry to the `sms` manifest: `menuKey: "sms.gateway"`, `surface: ADMIN`, `groupKey: "settings"`, `path: "settings/sms"`, `permissionKey: sms.gateway.read`, `settingsTopicKey: SETTINGS_TOPIC.AUTOMATION`, a free `order` in that topic, and a `labelTermKey` message key in BN and EN. The page is `apps/admin/src/app/[orgSlug]/settings/sms` (follow the neighbouring settings pages). The menu count tests in `packages/contracts` and `apps/api` move by one.
- The last-sends list needs `sms.log.read`; hide it without that permission.
- Decision 18: the platform panel's navigation is the client list `apps/platform/src/shell/navigation-entries.ts`; add the entry there (`platform.sms.read`). Save and test need `platform.sms.write`.
- The API is merged: do not change it. If a screen needs a field the API does not return, stop and ask.

## Files — Part A1
| Path | Create/Change | Owns / add-only | Purpose |
|---|---|---|---|
| `apps/api/src/kernel/secrets/{secret-box.ts,index.ts}` (+ test) | Create | owns | decision 2 |
| `apps/api/src/modules/integration/sms/**` (manifest, index, README, domain, application, infrastructure drivers + stub tests, presentation) | Create | owns | decisions 1, 3, 6, 8–15 |
| `apps/api/src/config/env.schema.ts`, `read-storefront-config.ts`, `app-config.ts`, `load-config.test.ts`, `apps/api/.env.example` | Change | owns | decisions 2, 7, 10, 11 |
| `apps/api/src/modules/commerce/contact/**` (`SmsSender` purpose, sender selection) | Change | owns | decisions 7, 8 |
| module registry, `routes/tenant-module-routers.ts`, `routes/platform.ts` | Change | add-only | mount |
| `apps/api/src/modules/core/iam/domain/system-role-grants.ts` | Change | add-only | decision 5 |
| `packages/contracts` (`sms/`, permissions, platform permissions, audit actions, setting key, rule keys) | Change | add-only | decision 4 |
| `packages/validation/src/sms/**` | Create | owns | decision 14 |
| `packages/i18n` catalogs | Change | add-only | messages |
| `apps/api/src/test-support/**` (test key, local HTTP stub helper) | Change | add-only | tests |
| `docs/04-DECISIONS.md` (ADR-147), `docs/10-MODULE-CATALOG.md` row `sms`, handoff `docs/handoffs/M.9-api.md`, STATUS row M.9 | Change/Create | add-only | decision 16 |

## Interfaces (A1)
```ts
// kernel/secrets
export function sealSecret(plaintext: string, binding: string): string;
export function openSecret(sealed: string, binding: string): string;

// integration/sms/application/ports
export interface SmsDriver {
  /** Resolves with a final result; throws SmsTransientError for a fault worth retrying. */
  send(input: { readonly msisdn: string; readonly text: string }): Promise<SmsDriverResult>;
}
export type SmsDriverResult =
  | { readonly outcome: "SENT"; readonly parts: number | null; readonly providerMessageId: string | null }
  | { readonly outcome: "REFUSED"; readonly failureReason: SmsFailureReason; readonly providerErrorCode: number | null };

// integration/sms/index.ts
export function buildGatewaySmsSender(dependencies: SmsModuleDependencies): {
  send(message: { readonly phoneE164: string; readonly text: string; readonly purpose: SmsPurpose }): Promise<void>;
};
```

## Tests — Part A1 (must exist and pass)
- `secret-box`: `a sealed secret opens with the same binding and fails with another organization's binding`; `a tampered sealed value fails without naming the value`; `production config refuses the gateway driver without CREDENTIALS_ENCRYPTION_KEY`.
- adaReach driver against a local HTTP stub (no network in CI): `sends Bangla text with contentType 2 and English with 1`; `logs in once and reuses the token`; `re-logs in once on 401`; `maps 1506 to BALANCE_LOW and 1503 to SENDER_NOT_ALLOWED without throwing`; `throws a transient error on 5xx, on 1502 and after the 10 s timeout`.
- BulkSMSBD driver: `posts the key in the form body, never in the URL`; `uses type unicode for Bangla`; `treats 202 as sent and 1007 as BALANCE_LOW`; `throws a transient error on 5xx and timeout`.
- Resolution and guards: `the organization's own active gateway wins over the platform's`; `a disabled or incomplete organization gateway falls back to the platform's`; `no gateway logs NOT_CONFIGURED and does not throw`; `a number outside Bangladesh is refused without calling the provider`; `the daily limit skips the send and logs SKIPPED_DAILY_LIMIT in the organization's local date` (fixed clock between 00:00 and 06:00 Dhaka); `smsPerMonth limits only platform-paid sends`; `the log stores the last three digits and never the text`.
- OTP and M.8b through the gateway driver: `a sign-in code is sent through the platform gateway and the sealed code is cleared`; `a permanent refusal does not retry the event`; `a transient fault retries the event`.
- Tenant API: `the owner saves an adaReach account and the read shows hasPassword but no password`; `an omitted password keeps the stored one`; `enabling an incomplete provider is refused with SMS_GATEWAY_INCOMPLETE`; `a stale version gets 409`; `the test send reports BALANCE_LOW from the provider`; `the sixth test send in an hour is refused`; `the audit lists changed field names only`; `a manager can read but not update`; `a cashier gets 403`; `another organization's gateway is never read or used` (cross-org); `the log list is paginated and filtered by outcome`.
- Platform API: `a super admin saves the default gateway and the read shows no secret`; `a support operator can read but not write`; `the platform test send answers without a tenant log`.
- No secret in logs: `no log line or audit change contains a password, an API key or a sealed value` (capture the logger in the API tests above).
- Existing contact, directory (M.8b) and config suites green; T1 §11 table in the handoff.

## Tests — Part A2
- Unit: the form keeps a stored secret when the field is empty; the provider switch shows the right fields; each outcome and failure reason has a message; read-only without `sms.credential.update`.
- Browser (admin): the owner saves a BulkSMSBD account against the test stack (`SMS_DRIVER=test-inbox` keeps sending to the inbox; the test checks the save, the "saved" state and the log list). Platform panel: the page loads, saves and shows "saved".

## Decisions — Part B (checklist, no code)
7. **Domain and TLS:** the storefront base domain (`STOREFRONT_BASE_DOMAIN`) and the site host; DNS records; TLS certificates; `TRUSTED_PROXY_HOPS` counted as `docs/ops/storefront-deployment.md` (M.6b) says.
8. **Deploy:** API, worker, storefront and admin with production env (`SMS_DRIVER=gateway`, a fresh `CREDENTIALS_ENCRYPTION_KEY` kept in the host's secret store and backed up: losing it means re-entering every SMS password); `npm run db:sync-indexes` before the first start (`docs/ops/deploy-indexes.md`); the production startup guard must pass.
9. **Backups:** daily MongoDB backups with 14-day retention and one restore drill before launch (with card 6.5 when it exists; until then a managed-database snapshot schedule).
10. **Seed the business:** the owner's organization on the `MATRIMONY` or `MATRIMONY_ISLAMIC` template (published by the platform admin), branding, static pages (M.6c editor), credit packs, payment info, review checklist and rejection reasons, consents text after the legal review. **SMS:** the platform default gateway in the platform panel (adaReach or BulkSMSBD with an approved sender ID), then a test SMS from the panel and one from the business settings; raise the owner's organization `smsPerMonth` through an entitlement override if the platform gateway is used.
11. **Pilot:** a closed pilot with a small group: sign-in by SMS, biodata submit, staff review (the M.8b SMS arrives), credit purchase verification, unlock, report and block, export and erase. Each step ticked by the owner; problems become cards.
12. **Monitoring:** error capture and the dead-letter list watched daily during the pilot; the SMS log checked for REFUSED rows; the providers' balance alerts set in their portals.
13. **Bangla SMS check:** before launch, send a real Bangla test SMS through BulkSMSBD and confirm it arrives readable. The `type` value (`unicode` vs `text`) in the BulkSMSBD adapter is unverified: the official docs page returned 404, and manoxen's adapter always sent `type=text`. The A1 T1 review checks the adapter against this item.

### Follow-up — owner/lead decision, 2026-10-26

Proceed with HTTPS POST, API key in the form body, and `type=unicode` for Bangla. Keep the Unicode flag value in one named constant inside the BulkSMSBD adapter; tests assert exact Bangla and English request bodies. Official developer examples confirm HTTPS POST but do not document `type=unicode`.

BulkSMSBD Unicode flag is unverified against the live provider; the owner sends a real Bangla test SMS during the M.9 B pilot before launch.

## Out of scope

Automatic failover between providers; provider balance reads; delivery reports (DLR); bulk or campaign SMS; notifying the owner when a limit skips a message (5.13); email and WhatsApp; a key-rotation tool (the `v1.` prefix leaves room for it).

## Risks & checks
- The real providers are never called in CI: every driver test uses a local HTTP stub, and the base URLs come only from config.
- A secret in a log or response is a T1 reject: the review greps the diff and the test log captures.
- OTP sign-in depends on this path: the OTP suites run with the gateway driver against the stub as well as with `test-inbox`.

## Done when
Part A1: tests pass, CI green, T1 review passed, `card:check` all PASS. Part A2: merge check passed. Part B: every checklist step ticked by the owner in `docs/ops/go-live-matrimony.md`.
