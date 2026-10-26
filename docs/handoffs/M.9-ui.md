# Handoff · M.9 Part A2 · SMS settings screens (admin and platform panel)

Branch `s/M.9-ui-sms-settings` (from `origin/main`, A1 merged). Plan `docs/plans/M.9.md` with Amendment A2-1. Tier T2.

## What was built
- **API (Amendment A2-1 only):** `apps/api/src/modules/integration/sms/module.manifest.ts` has one menu entry `sms.gateway` (admin, group `settings`, path `settings/sms`, permission `sms.gateway.read`, `settingsTopicKey: AUTOMATION`, order 10, icon `bell`, label `menu.sms.gateway`). No other API change.
- **Admin page** `/{orgSlug}/settings/sms` (`apps/admin/app/[orgSlug]/(app)/settings/sms/page.tsx`, screen code in `apps/admin/src/sms/`):
  - `sms-settings-page.tsx`: permission gate (`sms.gateway.read`), form for `sms.credential.update`, test panel for `sms.credential.update`, last sends for `sms.log.read`.
  - `sms-gateway-form.tsx` + `sms-form-fields.tsx`: enable switch, provider select, the chosen provider's fields only, Save with `version`; 409 shows the reload notice; `SMS_GATEWAY_INCOMPLETE` shows its own sentence.
  - `sms-state.ts`: write-only secrets (an empty box keeps the stored value; the stored value is never filled in).
  - `use-sms-gateway-save.ts`, `sms-save.ts`, `sms-api.ts`: API calls and refusal mapping.
  - `sms-test-panel.tsx` + `sms-test-view.ts`: test send, outcome in words (`sms.outcome.*`, `sms.failure.*`), account that sent (`your own account` / `the platform's account` / `not set up`).
  - `sms-logs.tsx`: card list (time, purpose, last three digits, outcome, failure), "Show more" by cursor, 25 per page.
  - `sms-labels.ts`: server-side labels passed to client components as props.
- **Platform page** `/sms-gateway` (`apps/platform/app/(panel)/sms-gateway/page.tsx`, code in `apps/platform/src/sms-gateway/`): same form and test button; read needs `platform.sms.read`, save and test need `platform.sms.write`. Navigation entry added to `apps/platform/src/shell/navigation-entries.ts` (last in the list).
- **i18n:** screen keys `sms.settings.*`, `sms.via.*`, `sms.test.*`, `sms.logs.*`, `sms.purpose.*` (screens catalogs); `menu.sms.gateway` (bundled); `platform.nav.sms`, `platform.sms.*` (platform catalogs). Both languages for every key. Outcome and failure texts reuse the A1 keys `sms.outcome.*` and `sms.failure.*`.

## Deviations (with reason)
1. **Admin test panel, 502 case:** the API answers a transient gateway fault with HTTP 502 and a body. The web client turns any non-2xx into an error without the body, so the screen shows the "gateway did not answer" text and not the outcome and account for that one case. The API did not change (card: do not change the API).
2. **Platform form duplicates the admin form's pure state helpers** (`apps/platform/src/sms-gateway/sms-gateway-state.ts` mirrors `apps/admin/src/sms/sms-state.ts`). Reason: there is no shared UI package for SMS, and the app-to-app share would need a new package, which the card does not ask for. The platform form is smaller (no source line, no log list).
3. **Response types** (`SmsGatewayView`, `SmsTestResult`, `SmsLogPage`, `PlatformSmsGatewayView`) live in the two apps. The API does not export response types either, so there was no contracts type to reuse. Not an enum or status, so no contracts change.
4. **Menu-count tests in apps/api** (`me-config-menu-api.test.ts`, `entitlement-api.test.ts`): the owner's expected menu lists gained `sms.gateway` and `sms.gateway.read` after `sales.returns`. Staff and viewer lists are unchanged (they do not hold the permission). `packages/contracts` tests needed no change.
5. The Amendment asked for `menuKey`, `surface`, `groupKey`, `path`, `permissionKey`, `settingsTopicKey`, `order` and `labelTermKey`; the icon key (`bell`) and the order (`10`) were my choice.

## Tests (names as in the plan)
Unit (admin, `apps/admin/src/sms/`):
- `sms-state.test.ts`: `never fills a secret box from the stored view, so a saved password is not shown again`; `keeps the stored password when the password box is left empty`; `sends a new password only when the person typed one`; `sends the version the page was drawn from`; `omits a provider part that was never set and left empty`; `maps the provider select value to a provider, and an empty value to none`.
- `sms-test-view.test.ts`: `names the account that sent the message`; `shows the failure reason in words, never the raw code`; `has a Bangla outcome message for <each SMS_OUTCOME>`; `has a Bangla failure message for <each SMS_FAILURE_REASON>`; `has a Bangla purpose label for <each SMS_PURPOSE>`.
- `sms-gateway-form.test.tsx`: `shows the controls to read-only members as off, and no Save button`; `shows the stored secret as saved and leaves its box empty`; `shows only the chosen provider's fields when the provider changes`; `keeps the stored password when the box is empty on save`; `asks for a reload when someone else changed the settings (409)`.

Unit (platform, `apps/platform/src/sms-gateway/`):
- `sms-gateway-form.test.ts`: `asks for a reload on a stale version`; `names the missing step of an enabled provider`; `shows any other API message under the form, by its key`.
- `apps/platform/src/shell/navigation-entries.test.ts`: expected lists updated (super admin and support see `/sms-gateway`).

Browser (not run locally, see below):
- `apps/admin/src/sms/sms.browser.test.ts`: `saves a BulkSMSBD account, shows it as saved without the key, and lists the last sends`; `lists SMS under Automation on the settings home`; `stays within the phone width and the script budget`.
- `apps/platform/src/sms-gateway/sms-gateway.browser.test.ts`: `lets the super admin save the default BulkSMSBD account and shows it as saved without the key`.

Note: the plan's wording "shows the outcome, the log list and the saved state" is covered by the admin browser test; the platform test checks save and "saved" (no log list on the platform page, as the plan says).

## Checks run locally
- `npm run lint`: exit 0.
- `npm run format:check`: exit 0.
- `npm run typecheck` (all workspaces): exit 0.
- Unit: admin `src/sms src/settings-home src/settings` 11 files, 67 tests passed; platform `src/sms-gateway src/shell src/i18n` 4 files, 17 tests passed; `packages/i18n` 7 files, 25 tests passed; `packages/contracts` 18 files, 76 tests passed.
- API (`--config src/test-support/vitest.config.ts`): the menu-related files and the module-contract checks, 10 files, 116 tests: all pass after the owner-menu expectation update (the 4 failures before the update were exactly those expectations).
- `next build` of the admin app: exit 0 (new route `/[orgSlug]/settings/sms` is in the build output).
- `turbo build` of the shared packages and `@banijjik/api`: exit 0.
- **Browser suites not run locally.** The browser stack starts its API on port 4000, which is held by another node process (PID 964) on this PC. A retry after about 3.5 minutes failed the same way (`POST /auth/register` answered `errors.origin_not_allowed`, because the other process has other CORS origins). Per rule 6, the browser suites are judged on CI.

## Known gaps (also in STATUS)
- **Phone navigation:** the platform bottom navigation shows only the first five entries (`MAX_BOTTOM_NAV_SLOTS = 5`). The platform super admin already had six entries, so `Operators` was already hidden on a phone; the new SMS entry is last, so it is hidden on a phone too. A menu order or shell decision for the lead.
- **Test panel 502 case:** see deviation 1.
- **Initial JS budget** of `/acme/settings/sms` is measured only by the browser test (CI).
- **Screen-level filter** of the last sends (by outcome) is not built: the plan asked for the card list and paging only.
- **Payload types** in the apps (deviation 3).

## CI
Pending. Link to be added after the push.
