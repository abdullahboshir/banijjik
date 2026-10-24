# Handoff: card M.7 · Part B (report screens) · IMPLEMENT · 2026-10-24

- **Branch:** `s/M.7-ui-reports` (from `main`, no rebase needed at the end)
- **Card:** M.7 Trust and safety for directories, Part B: admin report queue and report detail (plan decision 12, "Refresh B")
- **Model:** Sonnet

## Done

All files are in `apps/admin/src/directory/`, the two route wrappers and the screen catalogs. No API, contracts or validation file changed.

- **Routes:** `apps/admin/app/[orgSlug]/(app)/directory/reports/page.tsx` and `.../reports/[listingId]/page.tsx`. The menu entry `directory.reports` already existed from A1.
- **Queue** (`reports-queue-page.tsx`, `report-queue-card.tsx`): requires `directory.report.read`. Reads `GET /directory/reports?status=OPEN&page&limit=50` and `GET /directory/config`. Each card shows the listing number, the status badge, the open count, the reason labels from `reportReasons` (the key itself when the template dropped it) and the age of the oldest report. Card layout, whole card is the link (min height 44 px), previous/next pager.
- **Detail** (`report-detail-page.tsx`): requires `directory.report.read` and `directory.listing.read` (the listing number and status come from the listing read). Lists the OPEN reports (reason, time in the organization time zone, note) and links to the full M.3 review page. Loads at most 100 reports, the API cap of one resolve body.
- **Resolve sheet** (`resolve-reports.tsx`, `use-resolve-reports.ts`, `lazy-resolve-reports.tsx`): a bottom sheet with an outcome radio list and a note. It is loaded lazily after the reports render (route budget). It sends exactly the report ids that are on screen. Shown only to a writer holding `directory.report.resolve`.
- **Outcome options** (`report-resolve-state.ts`): `DISMISSED` and `WARNED` always; `LISTING_HIDDEN` only with `directory.listing.hide`; `ACCOUNT_BLOCKED` only with `contact.customerAccount.block`, both read from `/me/config`. The API still checks them (decision 6).
- **Stale reports:** a 409 whose message key is `errors.directory_report_stale` closes the sheet, shows a toast (`report-stale-toast.ts`) and refreshes the page, so the list reloads. Any other error shows an inline message and keeps the sheet.
- **i18n:** `directory.reports.*` keys, BN and EN, add-only in `packages/i18n/src/catalogs/screens/{bn,en}.json`. The `listing` term from `/me/config` is used in the title, subtitle, empty state and the hide/block labels.

## Deviations from the plan

- The detail page needs `directory.listing.read` as well as `directory.report.read`. The plan did not say which read the listing summary needs; a role with only the report permission sees "forbidden". Proposal: grant both together in the roles that moderate.
- The detail page shows the listing number, status and a link to the M.3 review page instead of repeating the M.3 field sections. This keeps the route small and avoids a second copy of the tier rules.
- The outcome list is gated by permission only, not by listing status. `LISTING_HIDDEN` on an archived listing is refused by the API (`directory.report.cannotHide`) and shows the generic failure message.
- Local browser run needed fresh builds of `apps/api/dist` and the admin `.next` (both are gitignored; the stack runs `node dist/main.js` and `next start`).

## Tests

Unit (vitest, jsdom for the sheet):
- `report-resolve-state.test.ts`: `offers only dismiss and warn without the second permissions`, `offers hiding only with the hide permission`, `offers blocking only with the account block permission`, `offers every outcome with both permissions`, `recognises the stale report error by its message key`, `reports the age of the oldest report in the largest whole unit`
- `resolve-reports.test.tsx`: `offers hide and block outcomes only with their permissions`, `shows the hide and block outcomes when both permissions are held`, `sends exactly the report ids on screen and returns to the queue`, `reloads the list with a toast when the reports are stale`, `shows a failure message for other errors and stays on the sheet`
- `reports-queue-page.test.tsx`: `lists the grouped queue with template reason labels and a link to the detail`, `shows the empty state when no listing has open reports`, `requests a bounded later page and offers previous and next links`, `does not fetch tenant data without the report read permission`

Browser (`directory.browser.test.ts`, phone viewport, real API):
- `resolves a reported listing with DISMISSED from the report queue` (queue shows the listing and the template reason, no horizontal scroll, resolve through the sheet, the report row is RESOLVED with outcome DISMISSED, the queue is empty afterwards)
- the existing route-budget test now also measures `/directory/reports` and `/directory/reports/[listingId]` against the shared admin budget (180 KiB)

## CI

https://github.com/abdullahboshir/banijjik/actions/runs/40087598864 (green on the feature commit)

## Known gaps

- The detail page lists at most 100 open reports; a listing with more shows the first 100 and the rest after those are resolved.
- No browser test for `LISTING_HIDDEN` or `ACCOUNT_BLOCKED` from the screen (the API parts cover the effects; the unit tests cover which options appear).
- An uncommitted change to `.claude/settings.json` appeared in this folder during the session (not made by this card); it is left out of the commits.
