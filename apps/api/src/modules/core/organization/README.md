# core/organization: organizations, locations and members

A signed-in user creates a business and lists every business they belong to.

- **Entities:** `Organization`, `Location`, `Member` (platform database, 09 sections 4.2 to 4.4). `Role` belongs to `core/iam`.
- **Public API** (`index.ts`): `registerOrganizationModels`, `buildOrganizationRouters`, `organizationManifest`.
- **Endpoints** (`/api/v1`): `POST /me/orgs`, `GET /me/orgs`.
- **Creation:** one transaction writes the organization, its six system roles (through iam's `index.ts`), its default location and the owner member (ACTIVE, OWNER role at ALL). The MEMBER number is taken just before it (gaps allowed).
- **Defaults:** country BD, currency BDT, timezone Asia/Dhaka, locale = the creator's, deployment SHARED. None of them is read from the request.
- **Slug:** 3 to 40 characters of `a-z`, `0-9` and single hyphens, trimmed and lower-cased, not on the reserved list. A taken slug is `409 DUPLICATE` on `details.field = "slug"`.
- **Rate limit:** 5 creations per user per 24 hours (interim until a verified identifier is required).
- **Listing:** three queries however many organizations; CLOSED ones are left out, SUSPENDED ones show their status.
- **Events:** declares `organization.organization.created`, `organization.location.created`, `organization.member.joined`; nothing is emitted until the event bus (card 1.5).
- **Permissions:** none yet (card 1.4).
- **Tenancy (card 1.3):** `Organization` is `NONE`; `Location` and `Member` are `ORGANIZATION` (tenant plugin, ADR-087). The module implements the kernel port `MembershipDirectory` (`buildMembershipDirectory()`, exported for `routes/v1.ts`). Organization creation runs as the new organization through the injected `OrganizationContextRunner`; `GET /me/orgs` spans organizations, so `routes/v1.ts` wraps `buildMyOrganizationsReader()` as system access (AUTH_LOOKUP).
- **Industry key:** stored as a plain field and never branched on (ADR-033, ADR-082).
- **Not here:** template publish check and trial subscription (1.6), slug change and history, invitations, ownership transfer, suspend and close.
