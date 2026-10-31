# website (OPTIONAL)

The public website of a business. Static pages (ABOUT, FAQ, GUIDE, TERMS, PRIVACY, REFUND) shipped in M.6a. Card 4.1 adds one organization-owned `Site` with a draft design and immutable published snapshots.

- One `Site` per organization. Draft lives on the site; published snapshots are append-only `WebsiteVersion` rows. `version` is a CAS token (stale → 409). After the first whole-site publish, public page reads use the snapshot, never the frozen legacy `SitePage` rows.
- Admin site: `GET/PATCH /orgs/:id/website/site`, `PUT /website/theme`, `GET/POST/PATCH /website/layout-pages`, `POST /website/publish`, `POST /website/unpublish`, `GET /website/versions`, `POST /website/versions/:websiteVersionId/restore` (`website.site.read|update|publish`; writes need organization-wide location authority; publish/unpublish/restore take `Idempotency-Key`).
- Admin legacy pages: `GET /orgs/:id/website/pages`, `PUT /orgs/:id/website/pages/:pageKey` (`website.page.read` and `website.page.update`). After a Site exists, those writes go through the same policy evaluator and CAS.
- Storefront: `GET /storefront/orgs/:id/site` (branding, feature switches, published titles; not gated by this module), `GET /storefront/orgs/:id/pages/:pageKey` (published pages only, 404 while the module is off), `GET /storefront/orgs/:id/published-site` (published design, 404 until the first publish).
- The body of a static page is Markdown text; the storefront renders it without raw HTML (M.6b).
- Custom domains (card 4.2 A2): `GET/POST /website/domains`, `POST /website/domains/:siteDomainId/verify`, `DELETE /website/domains/:siteDomainId`, `PATCH /website/domains/:siteDomainId` (`website.domain.manage`, all-location authority, mutations take `Idempotency-Key`). Add returns 202 PENDING; verify writes the outbox only; Cloudflare is A3. Production composition of `HostClaims` is A2I.
- Admin DNS wizard (card 4.2 B): `/{orgSlug}/website/domains`. The menu key is `website.domains` (order 61). A missing Site shows an empty state; Site creation stays 4.5.
- Storefront Checkout & Tracking (card 4.3):
  - Orchestration (`QuoteCheckoutUseCase`, `SubmitCheckoutUseCase`): `POST /quotes`, `POST /checkout` with storefront idempotency and rate limiting.
  - Access Authority (`CheckoutAccess`): Single source of truth for tracking, claim, replay, and export authorization. Owned by either `CUSTOMER` or `GUEST`.
  - Claim (`ClaimCheckoutUseCase`): `POST /checkouts/:checkoutId/claim` CAS-transfers access from `GUEST` to verified `CUSTOMER` matching the checkout contact snapshot phone. Revokes guest tracking and idempotency replay authorization.
  - Tracking & Projections (`ReadOwnRequestsUseCase`): `GET /checkouts/:checkoutId`, `GET /me/requests`, `GET /me/requests/:requestType/:requestId` (no-store, private projection).
  - Customer Privacy Participants (`buildCheckoutPrivacyParticipants`): Implements `CustomerDataExportParticipant` (`CHECKOUT` section with owned/claimed checkouts and request links) and `CustomerErasureParticipant` (revokes `CheckoutAccess`, scrubs PII in `Checkout.contactSnapshot` and `CheckoutQuote` inputs, while strictly preserving financial orders, bookings, enrollments, request links, accepted totals, and audit integrity).
- Decision records: ADR-144, ADR-149, ADR-P4-B.
