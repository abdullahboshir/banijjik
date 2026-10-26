# M.9 Part A1 — T1 review R2 (SMS gateways API)

Reviewer: lead (Opus 5.5, `banijjik-fa`) · Date: 2026-10-26 · Branch `s/M.9-api-sms-gateways` at `030101c7` (rebased on `main` `5a2f18e3`) · CI 40288019531 green · `npm run card:check` all PASS in `banijjik-m8a`.

**Verdict: passed with three small items fixed by the lead** (owner rule 2026-10-23: at most three small items → the lead fixes them on the branch and merges).

## R1 findings
| Finding | State | Evidence |
|---|---|---|
| F1 public key in production | fixed | `read-sms-config.ts` requires `CREDENTIALS_ENCRYPTION_KEY` whenever `isProduction`; test "requires the credentials key in production when SMS is disabled" |
| F2 throwing stand-ins in production wiring | fixed | `GatewayUseCases` takes a `tester`; the platform router builds `testPlatformGateway` and takes neither `limits` nor `policy` |
| F3 OTP and M.8b through the real gateway | fixed | `send-customer-otp-sms.gateway.test.ts` (sent and code cleared; permanent refusal not retried; transient fault retried, code kept) on real Mongo with the HTTP stub; `listing-review-sms.test.ts` gateway case |
| F4 non-JSON 4xx always transient | fixed, with a regression (L1 below) | body read as text, parsed only when JSON; a 4xx without JSON is a refusal |
| F5 hot file rewritten | **not fixed** (L2 below) | `tenant-module-routers.ts` still rewrote five lines and dropped the `access` destructure, because `buildTenantRouters` is at the 60-line limit |
| F6 secrets in logs, audits and responses | fixed, one weak spot (L3 below) | platform key, sealed values, BulkSMSBD tenant key and the cross-organization "never used" case are asserted |
| F7–F12 | fixed | `isBangladeshMobile` in `domain/gateway.ts` and `SMS_FAILURE_REASON.INVALID_NUMBER`; one `organizationId()`; audit `entityId` is `smsGatewaySettingId` (asserted); `import type` for `SmsConfig`; plan sections moved; drivers take a `timeoutMs` option |

## Fixed by the lead (commit on the branch)
- **L1 · the timeout no longer covered the body.** The F4 rewrite cleared the timer as soon as the headers arrived, so a provider that sent headers and then stalled the body held the worker's handler forever, while the comment still said "the timeout covers the body too". `smsPost` now keeps the timer until the body is read (`sendRequest` and `readBody` helpers). New `sms-http.test.ts`: "treats a body that stalls past the timeout as a transient fault"; "keeps a refusal whose body stalls past the timeout a permanent refusal".
- **L2 · hot file add-only (R1 F5).** `tenant-module-routers.ts` is back to `main` plus one line (`coreRouters.smsRouter` in `laterModuleRouters`). The SMS router is built in `core-tenant-routers.ts` by a new `buildIntegrationTenantRouters` (the `integration/*` modules), from `buildSmsTenantModuleRouter` in `routes/sms-adapters.ts`; `CoreTenantRouterInput` gains `config` (one line in `v1.ts`). This is the 3.8c layout.
- **L3 · a missing sealed value passed silently.** `expect(text).not.toContain(undefined)` passes, so the four sealed-value checks now first assert that the sealed value is a string of at least 16 characters.

Local run after the fixes: API typecheck, eslint and Prettier on the changed files; `vitest` on `integration/sms`, the OTP handler and gateway tests, `listing-review-sms`, the module contract and registry tests and `app.test.ts`: 11 files, 227 tests passed.

## Notes (no change needed)
- A test send that goes through the platform gateway, with no own row, is audited with the organization ID as `entityId` (there is no `smsGatewaySetting` row yet). Acceptable.
- A 2xx answer with a non-JSON body resolves with an empty body, which the drivers read as a refusal (no `response_code`). That is the safe side: no retry storm against a misconfigured endpoint.
- Live checks stay in Part B (item 13, the Bangla text on BulkSMSBD).
