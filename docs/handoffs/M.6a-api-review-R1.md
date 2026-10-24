# Review R1: card M.6a · Storefront reads and static pages (API, T1)

Reviewer: lead (Opus 5.5) · Date: 2026-10-25 · Branch head reviewed: `214b1897` (CI 40114461956 green on every job, `card:check` all PASS)

## Result
Passed. No code change needed. During the run the lead stopped one weakened test (commit 87a903e4: the module dependency refusal was replaced by a different assertion); the session restored it and `website` became tenant-disablable on the lead's decision (handoff deviation 9b).

## Checked
- `website` module: manifest, README, `SitePage` with `version`, unique `{organizationId, pageKey}` (a racing create is a 409, not a second row), versioned save through `updateVersioned`, repository reads through `models(ctx)`, errors other than duplicate key rethrown. Admin routes carry `website.page.read` / `.update` and validation; the audit row and the event carry ids and flags only, never page text.
- Storefront: `/site` returns only name, tagline, logo path, colours, feature switches and published page titles; `/pages/:pageKey` answers the same 404 for missing and unpublished pages and needs the module on; mounted behind the surface rate limit and the business context, before the contact router's customer-login switch (deviation 3).
- `/directory/form`: storefront-visible field definitions only, no data; `/directory/stats`: reads the summary row only and shows option counts only for a PUBLIC SELECT field; template validation refuses any other field.
- Stats: one aggregation on the `{organizationId, status}` index prefix per listing event, unchanged snapshots write nothing, `timestamps` and `version` on the row.
- Deviations 1–12 accepted (mostly composition-root wiring that follows the existing pattern; deviation 10: RETAIL and SALON now resolve `website` because their templates allow it).

## Follow-ups (not blocking; for the lead's list)
1. **Stale stats race:** the handler is UNORDERED; two listing events of one business handled at the same time can write in the wrong order, leaving an older snapshot until the next listing event. Low impact (home counts). Fix later with a recompute that compares `computedAt` or an ORDERED handler.
2. Option values with `.` or `$` would become Mongo keys in `countsByOption` (handoff gap); template options are platform-authored. Store the counts as an array if templates ever allow such values.
3. The handler is tested by calling `refreshListingStats` directly; no outbox-to-handler test (handoff gap).
4. Existing directory storefront routes (listings, detail, my listing) are not gated by the directory module (predates M.6a, handoff gap).
5. M.7 A2 erasure: check that anonymizing an APPROVED listing emits one of the five events, or the counts stay high until the next event.
