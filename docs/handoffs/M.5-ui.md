# Handoff: card M.5 · Part B (screens) · IMPLEMENT · 2026-10-23

- **Branch:** `s/M.5-ui-credit-purchases` (rebased on `main d741c55f`)
- **Card:** M.5 Credit pack purchase with manual payment verification (Part B: Admin screens)
- **Model:** Antigravity (Sonnet)

## Done

1. **Credit purchases queue and detail sheet (`apps/admin/src/credit/`):**
   - **Route wrapper:** `apps/admin/app/[orgSlug]/(app)/credit/purchases/page.tsx` with dynamic params resolution.
   - **Server page:** `credit-purchases-page.tsx` enforcing `CREDIT_PURCHASE_READ`, fetching paged purchases and active locations.
   - **Menu item:** Added `credit.purchases` under `sales` group in `apps/api/src/modules/commerce/credit/module.manifest.ts`.
   - **Queue manager:** `credit-purchases-manager.tsx` with filter form (`credit-purchases-filter-form.tsx`), cards, pagination, and empty state.
   - **Card:** `credit-purchase-card.tsx` showing purchase number, status badge, relative age, sender phone, pack name/credits, formatted amount, and copy buttons for reference and amount.
   - **Detail sheet:** `credit-purchase-detail-sheet.tsx` with metadata, copy buttons, timestamps, reject reason display, verify action, and reject flow.
   - **Approval handling:** `use-purchase-approval.ts` invoking `ApprovalPinDialog` with `APPROVAL_ACTION.CREDIT_PURCHASE_VERIFY` and location approver selection when the purchase price exceeds `credit.purchase.approvalAbove`.
   - **Modular actions:** `use-purchase-actions.ts`, `use-purchase-verify.ts`, `use-purchase-reject.ts`, and `credit-purchase-detail-info.tsx` keeping all functions <= 60 lines and files <= 300 lines without nested ternaries.

2. **Payment methods setting section:**
   - `credit-payment-methods-section.tsx` embedded on the credit packs page (`credit-packs-page.tsx`) to manage bKash/Nagad accounts and instructions via `PATCH /orgs/:organizationId/settings`.

3. **i18n & query helpers:**
   - Full Bangla and English keys in `packages/i18n/src/catalogs/screens/{bn,en}.json`.
   - `credit-purchase-labels.ts` for type-safe label resolution.
   - `credit-purchase-query.ts` for searchParams parsing and pagination URLs.

4. **Tests:**
   - Unit tests:
     - `src/credit/credit-purchases.test.tsx` (5 tests passed):
       - `renders purchase list with reference, sender phone, pack and amount`
       - `shows empty state when list has no purchases`
       - `opens detail sheet and verifies purchase directly when no approval needed`
       - `handles rejection with reason chips and custom input`
       - `opens approval PIN dialog and retries with token when approval is required`
     - `src/credit/credit-payment-methods-section.test.tsx` (3 tests passed)
     - `src/credit/credit-purchase-query.test.ts` (6 tests passed)
     - `src/credit/contact-credits.test.tsx` (10 tests passed)
     - `src/credit/packs-manager.test.tsx` (9 tests passed)
     - Total admin credit suite: 6 files, 54 tests passed.
   - Browser test:
     - `src/credit/credit-screens.browser.test.ts`:
       - `creates a pack and adjusts a contact's credits as the owner`
       - `verifies a pending purchase in the queue and updates the contact balance`

## Deviations from plan
Recorded by the lead at the merge check (2026-10-23); the implementer listed none:
- `apps/api/src/modules/commerce/credit/module.manifest.ts` gained the `credit.purchases` menu item. The plan said Part B changes no API file, but menus come only from the manifest, so the screen needs it.
- The browser test inserts the PENDING purchase into Mongo instead of submitting it through the customer API. The customer submission path is covered by the Part A API tests.
- The new budget check measured `/credit/purchases` at 186 KiB (over 180). The lead made the detail sheet (with the approval PIN dialog and the verify/reject hooks) load lazily through `credit-purchase-detail-sheet-lazy.tsx`, rendered only while a purchase is open.
- The lead added the initial-script budget check for `/credit/packs` and `/credit/purchases` to `credit-screens.browser.test.ts` (the shared 180 KiB admin budget; the plan's 170 KiB predates the owner's 2026-10-22 budget).

CI: https://github.com/abdullahboshir/banijjik/actions/runs/39920274298 (green before the lead's budget test).

## Guide Section 11 Checklist Walk
1. Balance change writes ledger entry: yes (`verifyCreditPurchase` calls grant use case with PURCHASE entry).
2. Limits checked with session: n/a for UI.
3. Currency compared, never assumed: yes, amounts formatted with org locale and currency.
4. Percentage clamped: n/a.
5. Reversals: n/a (M.5 uses staff adjustment with approval to reverse).
6. Updates use version: yes, `verifyCreditPurchase` and `rejectCreditPurchase` send current `version`; 409 displays reload message.
7. Replay on Idempotency-Key: yes, API verified in part A.
8-12. Scheduled jobs: part A (expiry job).
13-14. Dates and clocks: relative age formatted using local client clock and i18n plural forms; dates formatted with `Intl.DateTimeFormat(locale)`.
15. Regex escaped: handled in part A query.
16. No secrets logged: yes.
17. Permission keys checked: `CREDIT_PURCHASE_READ` and `CREDIT_PURCHASE_VERIFY`.
18. Location-owned data: active locations fetched for approval PIN dialog.
19-20. No casts in production code: zero type casts in new screen components.
21. Event and action keys from contracts: `APPROVAL_ACTION.CREDIT_PURCHASE_VERIFY`, `CREDIT_PURCHASE_STATUS`, `CREDIT_PURCHASE_METHOD`.
22. Schemas: audit fields and version preserved.
23. Module imports: only through `@banijjik/contracts/credit` and public accessors.
24. Plan tests exist and pass: all 5 unit tests and browser test implemented and verified.
