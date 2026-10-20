# Plan: card M.3 · Directory moderation screens (admin)

Tier: **T2** (screens over the M.2 API; no new rules) · Planned by: Opus 5.5 (Claude) · Implemented by: Cursor or a Claude Code session · Date: 2026-10-20 · Based on commit: `main 8258669` (M.2 merged)

Track M (`docs/16-MATRIMONY-TRACK.md`), third card. **Can start now**, beside 3.6. Reserved ADR number: **ADR-129**, only if needed.

## Goal
The site's team reviews submitted listings (biodatas) quickly on a phone or a laptop:
- a queue, oldest first
- the full listing with every field in its sections
- the template's checklist beside it
- approve, or reject with the template's reasons and a note
- hide or unhide a published listing
- search listings by number

The words come from terms ("বায়োডাটা").

## Inputs read
- `docs/16-MATRIMONY-TRACK.md` §3.1, `docs/plans/M.2.md` and `docs/handoffs/M.2.md` (staff API: `GET /directory/queue`, `GET /directory/listings/{listingId}`, `POST …/approve`, `…/reject`, `…/hide`, `…/unhide`; permissions `directory.listing.{read,review,hide}`)
- 3.13 `PageLayout` and `PageSection`, 2.5 custom field display, 2.8 terms, 3.0 private file URLs (photos), `13-UX.md` §3, §5, §12

## Decisions
1. **Menu** (from the directory manifest; add the entries if M.2 did not): group `directory` (label from the term `listing`) with:
   - **Review queue** (`directory.listing.review`)
   - **All listings** (`directory.listing.read`)

   Words from the term `listing`, fallback catalog keys.

2. **Queue page** (`/[orgSlug]/directory/queue`):
   - SUBMITTED listings, oldest first, paged (≤ 50)
   - card per listing: number, submitted time, key public fields (the template's first section), "edited after approval" badge when it came back for review
   - a count in the menu badge (from the queue's total, refreshed on load)

3. **Review page** (`/[orgSlug]/directory/listings/[listingId]`):
   - **Left (or top on phones):** the listing by sections with every tier visible (staff see all), with tier labels ("সবার জন্য", "সদস্যদের জন্য", "কানেকশনের পর", "শুধু অফিস"), so the reviewer knows what the public will see.
   - Photos through private URLs, when the photo policy allows photos.
   - **Right (or bottom):** the template's review checklist (data, from the template's `directory` block) as checkboxes for the reviewer's own use (not stored), then:
     - **Approve** (confirm)
     - **Reject:** reason chips from the template (multi-select, final reasons marked) and a note; required when rejecting
     - **Hide / Unhide** for published listings (`directory.listing.hide`)
   - Version conflicts (another reviewer acted) show "This listing changed; reload".

4. **All listings page:**
   - filters: status, listing number, submitted or published date range
   - paged list with status badges (tones added to the ui status map: SUBMITTED warning, APPROVED success, REJECTED danger, HIDDEN neutral, DRAFT neutral)

5. **Budget and phone:** ≤ 170 KiB per route; the review page loads sections lazily; touch targets ≥ 44 px; no sideways scroll at 375 px.

6. **No new API** unless M.2 lacks a needed read. If so, stop and ask (for example a queue count without the list).

## Files
| Path | Change |
|---|---|
| `apps/admin/app/[orgSlug]/(app)/directory/**`, `apps/admin/src/directory/**` (+ tests) | create |
| `packages/ui` (status tones for listing statuses) | change |
| `apps/api/src/modules/commerce/directory/module.manifest.ts` (menu entries, only if missing) | change |
| `packages/i18n` | add-only |
| `docs/handoffs/M.3.md`, `docs/STATUS.md` | |

## Tests (must exist and pass)
- [ ] **Unit:** queue cards, the tier labels, reject form (a reason required, final marked), approve and reject call the API and update the list, permission-driven buttons (STAFF can review but not hide when the grants say so), version conflict message.
- [ ] **Admin browser** (a test template with the directory module and a listing created through the M.2 storefront API in the test setup):
  1. the owner opens the queue
  2. opens the listing, sees PRIVATE fields labelled "শুধু অফিস"
  3. rejects with a reason
  4. the listing leaves the queue
  5. after resubmission (API) approves it
  6. finds it in All listings
  - Plus no sideways scroll at 375 px.
- [ ] Route sizes ≤ 170 KiB.
- [ ] Every existing suite green; full "Done means" list.

## Out of scope
- Public site (M.6)
- Reports from members (M.7)
- SMS on decisions (M.8)

## Done when
- The team can review, approve, reject and hide listings on a phone in the site's own words.
- The merge check passes.
