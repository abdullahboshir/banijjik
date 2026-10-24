# website (OPTIONAL)

The public website of a business. Card M.6a ships its first page kind: static pages (ABOUT, FAQ, GUIDE, TERMS, PRIVACY, REFUND).

- One `SitePage` per organization and page key. Saves are versioned: `version: 0` creates, any other value must match the stored version (stale → 409).
- Admin: `GET /orgs/:id/website/pages`, `PUT /orgs/:id/website/pages/:pageKey` (permissions `website.page.read` and `website.page.update`).
- Storefront: `GET /storefront/orgs/:id/site` (branding, feature switches, published titles; not gated by this module) and `GET /storefront/orgs/:id/pages/:pageKey` (published pages only, 404 while the module is off).
- The body is Markdown text; the storefront renders it without raw HTML (M.6b).
- Decision record: ADR-144.
