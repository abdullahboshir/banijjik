# Order screens (3.5a Part B)

Routes: `/{orgSlug}/orders` (list), `/{orgSlug}/orders/new` and `/{orgSlug}/orders/{orderId}`. All three read the sales API and check `sales.order.*` permissions; location writes follow the caller's assignments.

- **List:** status chips, search by number, name or phone, a location filter, cards on phones, paged. The payment status chip comes from the API (3.23); the browser never computes it.
- **New order:** contact picker with quick create, product search (name, SKU or barcode), quantity in the unit's words with the loose rule, add-ons, per-line and whole-order discounts, a live quote panel, then save a draft, place, or complete an instant sale. The order's totals are always the quoter's.
- **Detail:** status actions by status and permission, payment section with the receive-payment sheet (`requestType: ORDER`), cancel sheet (a net paid amount goes to store credit), edit sheet, history.
- **Discount approval:** a `403 APPROVAL_REQUIRED` opens the PIN dialog and retries the same action with the granted token (`order-approval.tsx`).
- **Refusals:** the API sends sales refusals as a business-rule error with `details.ruleKey`; `order-failure.ts` maps the rule key to its message.

Budget: 180 KiB initial JavaScript per route. The product picker, quote panel, edit sheet, cancel sheet, delete dialog, approval dialog, payment sheet and the toast library load on demand (`lazy-*.tsx`, `order-toast.ts`), and `@banijjik/validation` is imported only when a new contact is typed (`order-contact.ts`). Keep it that way: importing a dialog or the validation package statically puts 14 to 56 KiB back into the first load.
