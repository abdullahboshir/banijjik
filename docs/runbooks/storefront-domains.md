# Storefront Custom Domains & SaaS Routing Runbook

**Document version:** 1.0.0 (Card 4.2 Part C2, 2026-10-29)  
**Applicability:** Production operations, staging verification, Cloudflare for SaaS integration

---

## 1. Cloudflare for SaaS Setup

`banijjik` storefront supports free subdomains (`<slug>.<baseDomain>`) and merchant custom domains (`shop.example.com`) through Cloudflare for SaaS (Custom Hostnames).

### 1.1 Zone & Fallback Origin Configuration

1. **Zone:** The platform apex zone (e.g. `banijjik.com` or `sites.example.com`).
2. **Fallback Origin:**
   - Create a DNS record for the fallback origin (e.g. `storefront-fallback.banijjik.com`) pointing to the storefront Next.js server / load balancer.
   - In Cloudflare Dashboard: **SSL/TLS** -> **Custom Hostnames** -> Set Fallback Origin to `storefront-fallback.banijjik.com`.
   - Ensure Fallback Origin status is **Active**.

### 1.2 Cloudflare API Token Permissions

The API worker communicates with Cloudflare using a scoped API token. Minimum required permissions:
- `Zone - Zone:Read`
- `Zone - Custom Hostnames:Edit`
- `Zone - SSL and Certificates:Edit`

Configuration settings (`apps/api` environment):
```env
CLOUDFLARE_API_TOKEN="<secret-token>"
CLOUDFLARE_ZONE_ID="<zone-id-hash>"
CLOUDFLARE_FALLBACK_ORIGIN="storefront-fallback.banijjik.com"
```

### 1.3 Tenant Custom Hostname Flow

1. Tenant enters domain (e.g. `shop.merchant.com`) in Admin (**Settings -> Website -> Domains**).
2. API validates host normalization, checks against reserved hostnames, reserves platform `HostClaim`, and enqueues creation in Outbox.
3. Domain worker calls Cloudflare API `POST /zones/:zone_id/custom_hostnames`.
4. Cloudflare responds with:
   - `ssl.validation_records` (TXT or CNAME) for SSL issuance.
   - `ownership_verification` (TXT) for domain ownership.
5. Merchant adds the CNAME and verification TXT records to their DNS provider.
6. Worker polls verification status (`GET /zones/:zone_id/custom_hostnames/:id`). Once SSL and ownership are active, domain transitions to `ACTIVE`.

---

## 2. Reserved Hostnames (`STOREFRONT_RESERVED_HOSTNAMES`)

To prevent tenant takeover of platform infrastructure, apex zones, or standard services, the following hostnames and their variants cannot be claimed:

```ts
export const STOREFRONT_RESERVED_HOSTNAMES = [
  "admin",
  "platform",
  "api",
  "auth",
  "app",
  "billing",
  "cdn",
  "cpanel",
  "dns",
  "docs",
  "help",
  "imap",
  "mail",
  "ns1",
  "ns2",
  "pop",
  "smtp",
  "staging",
  "static",
  "status",
  "support",
  "webmail",
  "whm",
  "www",
] as const;
```

Rules:
- The base domain apex (`banijjik.com`) and any reserved subdomain (`api.banijjik.com`) are rejected during domain creation (`409 CONFLICT` with `WEBSITE_DOMAIN_INVALID` or `WEBSITE_DOMAIN_TAKEN`).
- Free subdomains matching reserved names (`admin.sites.banijjik.com`) cannot be claimed as merchant organization slugs.

---

## 3. Rollback & Unpublish Operations

### 3.1 Pointer-Based Cache Isolation

1. Every storefront public cache key includes the authoritative `publishedWebsiteVersionId`:
   ```text
   org:<orgId>:ver:<publishedWebsiteVersionId>:lang:<locale>:loc:<locationId>:proj:<projection>@v1
   ```
2. When an organization publishes a new revision:
   - `Site.publishedWebsiteVersionId` is updated in MongoDB transactionally.
   - Next incoming request to Next.js proxy resolves the new `publishedWebsiteVersionId` in trusted headers.
   - `readPublic` immediately targets cache keys for the new version. Old cached snapshots are never served, even before asynchronous invalidation completes.
3. When an organization rolls back:
   - `Site.publishedWebsiteVersionId` is updated back to the prior revision.
   - Requests immediately target the prior revision's cache keys.
4. When an organization unpublishes:
   - `Site.publishedWebsiteVersionId` is set to `null`.
   - `/resolve` returns 404. The proxy strips trusted headers and `readPublic` serves 404 (not cached).

### 3.2 Idempotent Invalidation

- An outbox event triggers storefront projection cache invalidation:
  `publicProjectionCache.invalidateOrganization(organizationId, websiteVersionId)`.
- Invalidation removes all memory entries for that organization and version. Calling invalidation repeatedly is safe and idempotent.

---

## 4. Domain Suspension & Removal Quarantine

### 4.1 State Machine

- `PENDING` -> `VERIFYING` -> `ACTIVE`
- `ACTIVE` -> `SUSPENDED` (when periodic reconciliation detects SSL or ownership loss)
- `SUSPENDED` -> `VERIFYING` -> `ACTIVE` (when merchant restores valid DNS records)
- `ACTIVE | SUSPENDED | FAILED` -> `REMOVING` -> `REMOVED`

### 4.2 Removal Quarantine

1. When a merchant deletes a custom domain:
   - `HostClaim.enabled` is immediately set to `false` in the database.
   - Next.js `/resolve` returns 404 immediately; traffic ceases routing.
   - `quarantineUntil` timestamp is set (minimum 24 hours).
2. The domain worker invokes Cloudflare API `DELETE /zones/:zone_id/custom_hostnames/:id`.
3. Only after reconciliation confirms Cloudflare removed the hostname is the `HostClaim` marked `REMOVED`.
4. A re-claim of the same domain by any organization requires a brand-new operation generation and re-verification.

---

## 5. Staging Verification Checklist (Owner Credentials Gate)

Before deploying custom domain automation to production, execute the following smoke tests on staging using live Cloudflare credentials:

- [ ] **Config validation:** Verify `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, and `CLOUDFLARE_FALLBACK_ORIGIN` pass startup checks (`npm run config:check`).
- [ ] **Domain Registration:**
  - Create custom domain `staging-test.<merchant-domain>` in Admin UI.
  - Verify API response is `202 PENDING` and outbox job `website.domain.requested` is scheduled.
- [ ] **DNS Instruction Inspection:**
  - Inspect DNS instructions returned in Admin UI: verify CNAME targets fallback origin and TXT record matches Cloudflare token format.
- [ ] **Reconciliation & Verification:**
  - Configure test domain in authoritative DNS.
  - Click **Verify Domain** in Admin UI.
  - Monitor worker execution: verify status advances to `ACTIVE`.
- [ ] **Storefront Routing & Canonical Links:**
  - Access `https://staging-test.<merchant-domain>/` via browser.
  - Verify HTTP 200 OK with correct merchant site content.
  - Verify `<link rel="canonical" href="https://staging-test.<merchant-domain>/">`.
  - Verify `https://staging-test.<merchant-domain>/robots.txt` points sitemap to canonical host.
  - Verify `https://staging-test.<merchant-domain>/sitemap.xml` lists canonical URLs only.
- [ ] **Rollback Smoke:**
  - Update page content and publish a new version. Verify updated content is visible immediately.
  - Restore prior version. Verify storefront immediately renders prior content without stale cache retention.
- [ ] **Deletion Cleanup:**
  - Delete domain in Admin UI.
  - Verify immediate 404 on `https://staging-test.<merchant-domain>/`.
  - Verify Cloudflare Dashboard shows custom hostname removed.
  - Verify claim status in MongoDB transitions to `REMOVED`.
