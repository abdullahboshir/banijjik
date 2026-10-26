# M.9 Part A1 — SMS gateway API handoff

Branch: `s/M.9-api-sms-gateways`  
Plan: [docs/plans/M.9.md](../plans/M.9.md)  
Tier: T1  
CI: pending final rebased commit; record the branch-head push run after it completes.

## What changed

- Added `integration/sms` with tenant and platform gateway settings, encrypted write-only credentials, audit actions, guarded explicit test sends, privacy-preserving SMS logs, Dhaka business-date daily limits, platform-paid monthly limits, and configured adaReach/BulkSMSBD drivers.
- Added worker wiring for customer OTP and directory review notifications. Permanent refusals resolve and transient provider errors retry the outbox event.
- Applied R1: production always requires the credential encryption key; platform gateway testing no longer wires unused throwing dependencies; non-JSON 4xx responses resolve as permanent refusals; timeout tests use short injected limits; the tenant router hot file retains its pre-existing lines unchanged.
- Added real-driver HTTP-stub integration coverage for OTP sent/refused/transient outcomes and M.8b review-result SMS. Expanded secret checks to tenant and platform keys and sealed values, and tested cross-organization platform fallback without using organization A's gateway.
- Added permissions, platform role grants, validation schemas, BN/EN messages, production encryption-key validation, and SMS configuration. Updated the SMS module catalog row.
- Tenant first-save now creates a tenant-scoped document so the tenancy plugin supplies/enforces the organization. Subsequent saves use version-checked updates. Audit entity IDs use the gateway row's `smsGatewaySettingId`.

## BulkSMSBD owner decision

The adapter uses HTTPS-configured POST, sends the API key in the form body, and uses `type=unicode` for Bangla. The flag is a single `UNICODE_FLAG` constant in the BulkSMSBD adapter; its tests compare the complete form body for Bangla and English. [Official BulkSMSBD developer examples](https://bulksmsbd.com/bulksms-api-bangladesh.php) show HTTPS POST but do not specify the Unicode flag name/value.

BulkSMSBD Unicode flag is unverified against the live provider; the owner sends a real Bangla test SMS during the M.9 B pilot before launch.

## Tests

- adaReach driver: `sends Bangla text with contentType 2 and English with 1`; `logs in once and reuses the token`; `re-logs in once on 401`; provider refusal mapping; transient 5xx, provider-code and timeout behavior.
- BulkSMSBD driver: exact English and Bangla form requests; 202/1007 mapping; transient 5xx and timeout behavior.
- SMS service: organization gateway precedence and platform fallback; not-configured and invalid-number no-send behavior; Dhaka date; daily/monthly limit skips; platform-only monthly quota.
- Secrets/config: same-binding open, wrong owner/field and tamper rejection; production gateway requires the encryption key.
- OTP event: required purpose, clear-after-resolved send/refusal, preserve sealed code on a transient error.
- Tenant/platform API on real Mongo: secret-free settings views and logs/audit, omitted-secret preservation, incomplete/stale writes, provider refusal and sixth-send rate limit, log filter/pagination, cross-organization isolation, manager read-only/cashier denied, support read-only, platform test with no tenant log.
- Typecheck and lint passed locally. Prettier passed locally. API integration tests cannot run locally because this Windows sandbox denies MongoDB's loopback connection (`connect EACCES 127.0.0.1`) and Vitest's temporary transform files fail with `ENOENT`; the contract suite has the same sandbox temp-file issue. CI remains the authoritative integration verification.

## Verification and deviations

- `npx turbo run typecheck --filter=@banijjik/api` — passed.
- `npx turbo run build --filter=@banijjik/api --filter=@banijjik/contracts --filter=@banijjik/validation --filter=@banijjik/i18n --filter=@banijjik/ids` — passed.
- Targeted ESLint and Prettier checks for changed code — passed.
- No code deviations from the approved A1 plan. A1 does not include the A2 settings UI/browser test.
- Full `npm run card:check` waits for green CI on the final handoff/STATUS push.

## T1 self-review checklist (§11)

| # | Finding | Evidence |
|---:|---|---|
| 1 | Balance/ledger mutation | n/a — SMS provider balance is read-only; no account ledger is changed. |
| 2 | Transactional limits/unique reversal | n/a — SMS cost limits are read-only counters; no financial or stock reversal exists. |
| 3 | Currency comparison | n/a — SMS has no currency amount or currency threshold. |
| 4 | Percentage clamping | n/a — no percentages. |
| 5 | Reversal completeness | n/a — no reversible ledger entry. |
| 6 | Versioned updates/stale conflict | `refuses a stale version and an incomplete enabled gateway`; repository version checks. |
| 7 | Idempotent money/stock POST | n/a — settings and test-send routes create no money, credit or stock. |
| 8 | Per-row scheduled-job recovery | n/a — no scheduled job added; outbox delivery retries transient SMS failures. |
| 9 | Keyset worker batches | n/a — no worker batch added. |
| 10 | Scheduled catch-up/replay | n/a — no scheduled job added. |
| 11 | State exit path | `NOT_CONFIGURED`, sent and refused are terminal send outcomes; transient failures throw for event retry; OTP test confirms code remains available on retry. |
| 12 | Job settings outside request | `buildSmsDependencies` resolves settings by organization ID in the handler context; no scheduled job added. |
| 13 | Organization-local date | `uses the organization's local business date across Dhaka midnight`; `skips at the daily cap and logs the organization local date`. |
| 14 | Fixed/date-boundary tests | `NOW` is 2026-10-25 19:00 UTC (01:00 Dhaka on 2026-10-26); both business-date tests use this fixed clock. |
| 15 | User regex safety | n/a — no user-controlled regex search. |
| 16 | Secret storage/logging/response | secret-box tests; tenant password and API key plus platform API key and sealed values checked against responses, audits and captured logs; ciphertext is owner/field bound. |
| 17 | Permission keys | Tenant and platform API tests cover owner/manager/cashier and super-admin/support; middleware uses contract permission keys. |
| 18 | Location tenancy/cross-location | n/a — gateway settings are organization-wide and use `requireAllLocations`; cross-organization isolation is tested. No location-owned SMS rows exist. |
| 19 | Unsafe casts in production | No `as unknown as` was added in production code; platform and tenant gateway testers are required dependencies. |
| 20 | Optional behavior-changing dependency | Driver, limits, policy, audit, message and sender dependencies are required. |
| 21 | Contract vocabulary | SMS outcomes, permissions, settings, audit actions and OTP purpose use contracts. |
| 22 | Schema/version/index/validation | Gateway schemas include version/audit fields and unique organization/scope indexes; log indexes start with `organizationId`; validation lives in `packages/validation`. |
| 23 | Module boundaries/index exports | SMS consumers import through `integration/sms/index.ts`; index exports no infrastructure class. |
| 24 | Plan tests/docs match | Driver, secret/config, selection/limits, real-driver OTP and M.8b gateway tests, and tenant/platform API cases listed above; BulkSMSBD follow-up wording matches the owner decision and remains unverified. |

## Known gaps

- CI and card gate remain open until the rebased final commit's run and final handoff/STATUS push are green.
- Live BulkSMSBD Unicode behavior remains unverified as stated above; owner action is scheduled for the M.9 B pilot.
