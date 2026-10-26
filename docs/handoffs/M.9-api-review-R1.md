# M.9 Part A1 — T1 review R1 (SMS gateways API)

Reviewer: lead (Opus 5.5, `banijjik-fa`) · Date: 2026-10-26 · Branch `s/M.9-api-sms-gateways` at `fdca2c6f` (base `6d316a5e`, 7 commits behind `main`) · Plan `docs/plans/M.9.md` Refresh A · ADR-147.

**Verdict: changes required.** The design follows the plan well: AES-256-GCM with the row-and-field binding, write-only secrets, base URLs from config only, `redirect: "error"`, last three digits in the log, transient faults throw and permanent refusals resolve, a version check plus a unique index on the first save, Dhaka business date, `smsPerMonth` only for platform-paid sends. F1–F6 must be fixed before merge; F7–F12 are small and may be fixed in the same round.

**Gate:** no CI run on this branch has finished (40273274915 and 40273442079 were cancelled). The next round needs the branch rebased on `main`, a green CI run on the final head, and `npm run card:check` all PASS.

**BulkSMSBD `type` (M.9 Part B item 13):** checked. The adapter sends `type=unicode` for text with any non-ASCII character and `text` otherwise, by HTTPS POST with the key in the form body, and treats `response_code` 202 as sent. The flag is the single constant `UNICODE_FLAG`. It matches plan decision 11. The live check stays with the owner in the Part B pilot (item 13).

## Must fix

**F1 — Credentials are sealed with a public key in production unless `SMS_DRIVER=gateway`** (`apps/api/src/config/read-sms-config.ts`).
`CREDENTIALS_ENCRYPTION_KEY` is required only when production *and* `SMS_DRIVER=gateway`. Otherwise it falls back to `DEVELOPMENT_KEY = Buffer.alloc(32, 7)`, which is in the public repository. The tenant and platform gateway routes are mounted whatever the driver is. So in production with `SMS_DRIVER=disabled`, an owner or the platform admin who saves an adaReach password or a BulkSMSBD key stores it under a key that anyone can read. When the real key is set later, those rows no longer open (an `INTERNAL` error on every send).
Plan decision 2: "required when `NODE_ENV=production`". Fix: require the key in production for every driver, and use the development default only outside production. Test: `production config refuses a missing CREDENTIALS_ENCRYPTION_KEY with SMS_DRIVER=disabled`.

**F2 — Throwing stand-in dependencies in production wiring** (`apps/api/src/routes/platform.ts` `mountSmsPlatformRouter`).
The platform router passes `limits.assertBelow` and `policy.read` that only `throw new Error("platform test does not use ...")`. `controller()` in `integration/sms/index.ts` then builds a full `SmsService` from them that the platform path never uses. This is a stub in production code (AGENTS.md DoD; §11 item 20). It also throws a raw `Error`, which reaches the client as a 500 if someone ever wires it.
Fix: the platform use case must not need an `SmsService`. For example, give `GatewayUseCases` a `tester: (phoneE164, text) => Promise<SmsResult>` dependency: the tenant side uses `SmsService.sendWithResult` with `GATEWAY_TEST`, the platform side uses the existing `platformTest`. Then `buildSmsPlatformRouter` takes neither `limits` nor `policy`.

**F3 — The plan's OTP / M.8b gateway tests are missing** (plan "Tests — Part A1", third block, and "Risks & checks": "the OTP suites run with the gateway driver against the stub").
`send-customer-otp-sms.handler.test.ts` uses a `vi.fn` sender, so the real path (handler → `buildGatewaySmsSender` → driver → stub → `SmsLog`) is never run. Add these tests on real Mongo with the HTTP stub (`sms-http-stub.ts`), through the event handler as the worker registers it:
- `a sign-in code is sent through the platform gateway and the sealed code is cleared`
- `a permanent refusal does not retry the event` (the handler resolves, an `SmsLog` REFUSED row exists, the code is cleared)
- `a transient fault retries the event` (stub 5xx: the handler throws, no SENT row, the code stays)

Also one M.8b case: the review-result notifier sends through the gateway and logs `LISTING_REVIEW_RESULT`.

**F4 — A non-JSON provider answer is always "transient"** (`infrastructure/sms-http.ts` `smsPost`).
`await response.json()` is inside the `try`, and the `catch` turns every error into `SmsTransientError`. Any 4xx with an HTML or empty body is therefore retried until the event dead-letters, even though the provider refused it for good. Examples: a 403 from an IP block, a 401 from a gateway proxy, a 404 from a wrong base path. For adaReach, a 401 without JSON never reaches the one re-login. Only 5xx, 429, timeout and network failures are transient (plan decisions 10 and 11).
Fix: read the body as text. Parse it as JSON only when it parses, and otherwise return `{ status, body: {} }` for a status below 500. That gives `REFUSED` / `PROVIDER_REFUSED` (adaReach 401 → `AUTH_FAILED` after its re-login). Tests: `a 403 HTML page is a permanent refusal, not a retry` (both drivers); `adaReach re-logs in once on a 401 without a JSON body`.

**F5 — Existing lines rewritten in a shared hot file** (`apps/api/src/routes/tenant-module-routers.ts`).
The diff removes `const { catalog, permissionGate, permission } = access;` and rewrites five existing lines to `access.permission` / `access.permissionGate` / `access.catalog`, plus a stray blank line. AGENTS.md "Parallel sessions" rule: hot files take added lines only. Fix: restore the original lines. Add only the import, the `buildSmsTenantModuleRouter(input, permission)` entry and the helper function. The new `config` field in `TenantRoutersInput` is fine.

**F6 — The "no secret anywhere" test covers one secret only** (plan: `no log line or audit change contains a password, an API key or a sealed value`).
Only `private-password` is checked against the logs and the tenant audit. Missing:
- the platform API key (`platform-secret`, `platform-key`) in the captured logs and in `platform_audit_logs`;
- the **sealed** values: read `passwordSealed` / `apiKeySealed` from `sms_gateway_settings` and `platform_sms_gateways`, and assert that neither string appears in the logs, the tenant audit, the platform audit or any response body;
- the BulkSMSBD tenant key.

Also extend the cross-organization case to "never **used**" (plan `another organization's gateway is never read or used`). Organization B has no own gateway; a test send from B must answer `source: PLATFORM` (or `NONE`), never organization A's provider, and must write no row in A's `sms_logs`.

## Small (fix in the same round)

- **F7** The Bangladesh mobile pattern `/^\+8801[3-9]\d{8}$/` is written twice (`application/sms-service.ts`, `application/gateway-use-cases.ts`). Make it one named domain constant, for example `isBangladeshMobile(phoneE164)` in `domain/gateway.ts` or `domain/phone.ts`. The `"INVALID_NUMBER"` literal in `platformTest` must use `SMS_FAILURE_REASON.INVALID_NUMBER`.
- **F8** `organizationId()` in `infrastructure/mongo-sms.repository.ts` and `smsOrganizationId()` in `routes/sms-adapters.ts` are the same function. Keep one: the module exports it, or the routes use the module's.
- **F9** The tenant audit writes `entityType: "smsGatewaySetting"` with `entityId` = the organization ID. Use the row's `smsGatewaySettingId` (ID rule: an entity is referenced by its own ID). Return it from `repository.save`.
- **F10** `AppConfig.sms` uses an inline `import("./read-sms-config.js").SmsConfig` type. Use a normal `import type` at the top of `app-config.ts`.
- **F11** `docs/plans/M.9.md`: the "Follow-up — owner/lead decision" subsection was put inside "## Out of scope". The out-of-scope sentence now sits under the follow-up heading. Move the subsection to just after Part B item 13, and keep "## Out of scope" followed by its own sentence.
- **F12** The driver timeout tests wait 11 s of real time each (adaReach and BulkSMSBD). Use `vi.useFakeTimers()` with `advanceTimersByTimeAsync`, or let the driver take the timeout from a constructor option (default 10 s) so the test can pass a short one.

## Notes (no change needed)
- `changedFieldNames` always lists `enabled` and `activeProvider`, even when they did not change. That is acceptable: names only, no values. The handoff should say "submitted field names", not "changed".
- The tenant test send may go through the platform gateway (decision 6) and skips both cost guards. That is as planned: 5 per hour per organization.
- Daily and monthly counts are reads, not reservations, as ADR-147 accepts.
- Gateway settings writes run in `withTransaction` with the audit entry. The platform and tenant models share the platform client session, so the transaction covers both.

## Next round checklist (implementer)
1. Fix F1–F12. Each new test is named as above.
2. Rebase on `main` (or merge `origin/main` into the branch). Run the `packages/contracts` tests after the rebase: the permission and audit counts move when other branches add keys.
3. Push, wait for a green CI run on the final head, run `npm run card:check` (all PASS), and update the handoff (T1 table rows 16, 19, 20 and 24, plus the CI link).
