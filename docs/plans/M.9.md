# Plan: card M.9 · Owner's matrimony site live

Tier: Part A T1 (SMS provider driver: secrets, cost, customer sign-in) · Part B ops (owner and lead, no implementer session) · Planned by: Opus 5.5 (lead) · Date: 2026-10-25 · Based on commit: `main 077f368`

## Owner decisions needed first (doc 16 §6)
| # | Decision | Blocks |
|---|---|---|
| 2 | **SMS provider** (P5): which Bangladeshi SMS gateway (for example SSL Wireless, BulkSMSBD, Alpha SMS) or an international one; the account, sender id and price per SMS | Part A |
| 6 | **Site name and domain** (or a platform subdomain at first) | Part B 1–2 |
| 7 | **Legal review** of personal-data handling (consents, erasure, export, retention) | going live |
| — | Hosting: where the API, worker, storefront and admin run, and MongoDB and Redis (managed or self-hosted) | Part B |

Part A can be built against the provider's public API documentation as soon as decision 2 is made. Nothing in Part B is code.

## Session parts
- **Part A, SMS provider driver** (branch `s/M.9-api-sms-provider`, T1 review): decisions 1–6. Starts when the owner names the provider.
- **Part B, go-live checklist** (owner with the lead): decisions 7–12. After M.6c, M.8b and Part A merge, and after the legal review.

## Decisions
### Part A
1. **One new `SmsSender` driver** in `apps/api/src/modules/commerce/contact/infrastructure/` for the chosen provider, selected by `SMS_DRIVER=<provider-key>` (add the key to `SMS_DRIVERS` in `config/env.schema.ts`). `test-inbox` stays for development and tests; production refuses `test-inbox` as today.
2. **Config** through the validated env only: `SMS_PROVIDER_API_KEY` (secret), `SMS_PROVIDER_SENDER_ID`, `SMS_PROVIDER_BASE_URL` (default the provider's), all required when the driver is selected; never logged (ADR-119), never committed. Document them in the env example with placeholder values only.
3. **Sending** happens only in event handlers (already true: OTP and M.8b go through the outbox, ADR-090). The driver does one HTTPS POST with a 10 s timeout; a 5xx or a timeout throws (the event retries with its backoff); a 4xx that means "bad number" or "blocked" is logged at warn with the phone's last 3 digits only and does **not** throw (no retry loop on a permanent refusal).
4. **Bangla text:** send as Unicode (the provider's flag for it); a message longer than one Unicode part is allowed but logged at info with its part count (cost visibility).
5. **Cost guard:** a per-organization daily cap `sms.dailyLimit` (setting, INTEGER, default 500); above it the driver refuses with a logged warning and the event is skipped (not retried). The existing OTP rate limits stay.
6. **Tests:** the driver against a local HTTP stub (no network in CI): success, 5xx retries, 4xx permanent, timeout, Unicode flag, secrets never in logs, the daily cap. A manual smoke test with the real provider is done by the owner in Part B.

### Part B (checklist, no code)
7. **Domain and TLS:** the storefront base domain (`STOREFRONT_BASE_DOMAIN`) and the site host; DNS records; TLS certificates; `TRUSTED_PROXY_HOPS` counted as `docs/ops/storefront-deployment.md` (M.6b) says.
8. **Deploy:** API, worker, storefront and admin with production env; `npm run db:sync-indexes` before the first start (`docs/ops/deploy-indexes.md`); the production startup guard must pass.
9. **Backups:** daily MongoDB backups with 14-day retention and one restore drill before launch (with card 6.5 when it exists; until then a managed-database snapshot schedule).
10. **Seed the business:** the owner's organization on the `MATRIMONY` or `MATRIMONY_ISLAMIC` template (published by the platform admin), branding, static pages (M.6c editor), credit packs, payment info, review checklist and rejection reasons, consents text after the legal review.
11. **Pilot:** a closed pilot with a small group: sign-in by SMS, biodata submit, staff review (the M.8b SMS arrives), credit purchase verification, unlock, report and block, export and erase. Each step ticked by the owner; problems become cards.
12. **Monitoring:** error capture and the dead-letter list watched daily during the pilot; the SMS provider's balance alert set.

## Files (Part A)
| Path | Create/Change | Owns / add-only | Purpose |
|---|---|---|---|
| `apps/api/src/modules/commerce/contact/infrastructure/sms-<provider>.ts` (+ test with a local stub) | Create | owns | decisions 1, 3, 4 |
| `apps/api/src/config/env.schema.ts`, `read-storefront-config.ts`, env example | Change | owns | decision 2 |
| `apps/api/src/modules/commerce/contact/index.ts` (driver selection), contact manifest (setting `sms.dailyLimit`) | Change | owns / add-only | decisions 1, 5 |
| `packages/contracts` (setting key) | Change | add-only | decision 5 |
| handoff `docs/handoffs/M.9-api.md`, STATUS row M.9, `docs/ops/go-live-matrimony.md` (Part B checklist with the owner's ticks) | Create/Change | | |

## Out of scope
A second provider or failover; email; WhatsApp; delivery reports from the provider.

## Done when
Part A: tests pass, CI green, T1 review passed, `card:check` all PASS. Part B: every checklist step ticked by the owner in `docs/ops/go-live-matrimony.md`.
