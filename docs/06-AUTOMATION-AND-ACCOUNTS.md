# Accounts, Tenancy Modes, Seller Automation, Website Design Control

Companion to `01-ARCHITECTURE.md`. Decisions are in `04-DECISIONS.md` (ADR-022 to ADR-032). External-platform facts (Meta, WhatsApp, couriers) change often: **verify against the provider's current docs at the start of the relevant card**, and record the result in STATUS.md.

---

## 1. Product purpose (the "why" in one page)

Target user: a small seller or service business owner in Bangladesh, mostly non-technical, working from a phone.
Goal: **cut the seller's repeated daily work from first sale to delivery.**

The flow we automate end to end:

```
Create/import product → publish/boost on Facebook (ad) → customer messages (Messenger / Instagram / WhatsApp)
→ bot answers from the catalog → draft order → seller/customer confirms or cancels
→ courier consignment (Steadfast / Pathao / RedX) or own rider → live tracking → COD cash settlement → sales report
```

Principles for this flow:
1. **The catalog in banijjik is the single source of truth.** Facebook posts, chatbot answers, the website and POS all read from it.
2. **No technical setup for the seller.** Every connection is a button + a guided wizard. The seller never creates a developer app.
3. **Human stays in control** of money-spending and risky actions (ad spend, suspicious COD orders, refunds).
4. **Everything runs through channels, not one platform.** Messenger, Instagram, WhatsApp and a web widget are all "channels" feeding one inbox.

---

## 2. Identity: one person, many businesses (ADR-022)

- **User** = a person, identified globally by a verified email or phone. **Organization** = one business with one industry and its own subscription. **Membership** links a user to an organization (with role + location assignments).
- A user who buys a second business subscription **does not log in again**. The session belongs to the user. The active organization is chosen by the URL (`/[org]/...`) and validated against the user's memberships on every request (cached). The account menu lists all organizations; switching = navigate to another `/[org]` path.
- **Same business, extra capabilities** (a salon that also sells products): enable more **modules** in the same organization. **Separate business** (own books, own brand): a second organization.
- Billing owner: the organization has an `ownerUserId`. A user may own many organizations. Consolidated invoicing across organizations is a later feature.
- Customers of tenants (portal users) are a different identity type (`Contact` + portal login) and never mix with staff users.

## 3. Tenancy modes (ADR-017 amended, ADR-023)

| | Shared (default) | Dedicated (enterprise, later) |
|---|---|---|
| Data | One database, every document has `organizationId` | One database per organization |
| Isolation | Tenant plugin + tests | Physical isolation + the same plugin as a second guard |
| Same codebase | Yes | Yes |
| When | All customers at launch | Large customer, compliance need, or a high plan |

Rules that make dedicated possible without a rewrite:
- Organization record (in the **platform database**) has `deployment: SHARED | DEDICATED` and, for dedicated, an encrypted connection reference.
- Code never imports models directly in business code. It gets them from the kernel (`models(ctx)`), which resolves the shared connection or the tenant's own connection from the tenant context. Cards 0.4 and 1.3 must build this accessor.
- Platform data (organizations, plans, industries, module catalog, platform users) lives in the platform DB and is never tenant-scoped.
- Moving a tenant shared → dedicated = copy all documents where `organizationId = X` into the new DB, switch the flag, verify counts, with a downtime window. This is cheap only because every document has `organizationId`.
- Connection pool limit for dedicated tenants is a config value. Migrations run per database. Backups are per database.
- **Not built until a paying customer needs it** (Phase 8). Only the accessor and flag exist from the start.

**Own domain ≠ own hosting (ADR-031).**
- **Own domain on shared hosting** (most customers want this): a tenant website gets `<slug>.<platform-domain>` free, and can add a custom domain (`shop.example.com`). This uses a custom-hostname/SSL service at the edge (e.g. Cloudflare for SaaS custom hostnames) that maps host → organization automatically. The seller only adds one DNS record, with a guided wizard.
- **Managed dedicated** (enterprise): we host their own database (and optionally their own app instance) on our infrastructure. Same code, same release, same Meta app.
- **Self-hosted Docker given to the customer: rejected for now.**
  - It hands over our code (piracy risk).
  - It splits customers across versions we must patch and support.
  - It breaks the one-click Meta connect, because every self-hosted copy would need its own Meta app and App Review.
  - Reconsider only for a large licensing deal, as a separate ADR.

## 4. Connecting channels (ADR-024)

### 4.1 Facebook / Messenger / Instagram: one-click connect
- The **platform owner creates one Meta app** (P4) and gets it verified and approved. **Sellers never create apps, secrets or webhooks.**
- Seller flow in the dashboard: `Channels → Connect Facebook` → Facebook login popup → choose Pages (and the linked Instagram account) → grant permissions → done.
- We store the Page access token (encrypted), subscribe the Page to our app's webhook through the API, and show a "Connected" status. Seller must be an admin of the Page, with no developer access needed.
- Webhook is one endpoint for all sellers. The `pageId` in each event maps to the organization. Signature is verified with the app secret.
- Health: a token-expiry/permission monitor shows a "Reconnect" banner and sends a notification. Failed sends are retried or surfaced.
- **Risk:** until Meta grants Advanced Access (Business Verification + App Review for messaging permissions), only users with a role on our app can connect. This gates the whole automation phase. Start P4 early.
- Messenger standard messaging window is 24 hours after the customer's last message. Outside it only specific tags/templates are allowed. The bot must respect this (verify current rules).

### 4.2 WhatsApp
- Official **WhatsApp Business Platform (Cloud API)** only. Onboarding via **Embedded Signup** so the seller connects their own number inside our dashboard (we normally need to be a Tech Provider for this; verify current requirements).
- Business-initiated messages need approved templates and have per-conversation cost. Customer-initiated service replies have a 24-hour window.
- A number already used in the personal/Business app has limits (coexistence options exist; verify before promising).
- **Do not use unofficial WhatsApp Web libraries** (account ban risk, terms violation) for a product we sell.

### 4.3 Website chat widget
- A web chat widget is one more channel, for sellers who want chat on a website. It is a single `<script>` tag, optional.

### 4.4 Channel abstraction
`Channel` (type, external account id, credentials ref, status) → `Conversation` → `Message`. The inbox, bot, handoff and order extraction work on this abstraction, so adding a channel does not change the bot.

## 5. Chatbot: what it answers from (ADR-025)

The bot answers **only from banijjik data** (catalog, stock, price, delivery charge and zones, policies, FAQs, business hours). It never depends on a seller's website.

| Seller situation | What we do |
|---|---|
| Only a Facebook Page, no website | The bot uses the banijjik catalog. The seller also gets a free banijjik storefront (Phase 4) if they want one. |
| Has a website and a Page | Same: the bot uses the banijjik catalog. The seller's site is untouched. We never ask for access to their site or code. |
| Wants their existing site's products in banijjik | Import (CSV/Excel/feed URL) now. Later, a **read-only connector** (WooCommerce REST read-only key, Shopify app) mirrors their products and stock into the catalog on a schedule/webhook. Their website stays the system of record for mirrored fields. The bot reads the mirror, never the website live per message (latency, fragility). Public-page/sitemap scraping is only a one-time import fallback with the seller's consent, never live. |
| Wants chat on their own site | Optional widget script (one line). They decide. |

Bot behaviour:
- Retrieval from the catalog (search by name, category, attributes, price range) plus rules; an LLM phrases answers and extracts order fields. It must not invent prices, stock or policies. If unsure, it hands off to a human.
- **Retrieve, don't dump:** send only the top-k matching products (k ≈ 5–10) plus policies to the LLM, never the whole catalog. A whole-catalog prompt does not scale past a few dozen products and multiplies cost.
- **"Not found" ≠ "out of stock".** If retrieval finds nothing, the bot says it will check and hands off. It only says "out of stock" when stock data says so.
- **Structured output, not text flags:** the LLM returns JSON or tool calls (`reply`, `handoff{reason}`, `draftOrder{...}`, `askField{...}`). Handoff is never a magic string inside free text.
- **No price invention or negotiation:** discounts and offers come only from active promotion rules in the database.
- **Prompt-injection safety:** customer text is data, never instructions. The bot has no tools that change prices, stock or refunds.
- **Language:** Bangla, English and Banglish input. Reply tone is configurable per org (e.g. "ভাইয়া/আপু" vs formal).
- **Context:** the last N messages plus a structured conversation state (product in focus, cart, collected fields), not a growing transcript.
- **Cost ladder (ADR-030):**
  1. Rules, FAQ and exact-match/semantic cache answer common questions (delivery charge, address, hours) with no LLM.
  2. A small, cheap model handles normal product Q&A and field extraction.
  3. A larger model only on low confidence.
  - Prompt caching for the fixed system prompt. Short output limits. Per-org monthly AI message quota by plan, with a usage meter. Over quota → rules-only mode + seller notification.
- Context from the entry point: a comment or message that comes from a specific post or ad (referral data) is linked to the product via the `OfferingSocialLink` mapping, so the bot knows which product the customer means.
- Order extraction: items, quantity, name, phone, address, delivery area → **draft order** → customer confirms inside chat → order is created (seller can require manual approval).
- Handoff: customer asks for a human, the bot is not confident, or a risk rule fires → conversation goes to the inbox with the bot paused.
- Bot per-seller settings: on/off per channel, tone, working hours, auto-confirm rules, language (BN/EN).
- Guardrails: rate limit per conversation, message log, cost cap per organization (LLM usage is a plan limit).

## 6. Product entry without hassle (ADR-026)

Single source: the banijjik catalog. Many ways in, many ways out.

**In (pick the easiest per seller):**
1. Quick-add form on mobile: photo (camera), name, price, stock. Under 30 seconds per product. Remembers last category.
2. **Import from a Facebook post:** the dashboard lists the Page's recent posts; "Import as product" pre-fills name, price and images using text/image extraction; the seller reviews and saves. The post is then linked to the product (`ProductSocialLink`).
   - **Automatic drafts:** when the Page publishes a new post (Page feed webhook), the system detects a product post, creates a **draft** product and sends the seller a one-tap "Approve / Edit / Ignore" notification on mobile. Drafts never reach the bot or storefront until approved, because a post can be a non-product post, a price can be mis-read, and posts usually lack stock and variants.
   - **"Import last N posts"** for onboarding (e.g. last 100): batch extraction into a review screen with approve-all / fix / skip. Most sellers fill their catalog this way on day one.
3. Bulk: CSV/Excel template, and "photo/PDF of a price list → draft products" with review (AI-assisted, never auto-saved without review).
4. Existing website: feed/CSV import (Phase 8 connectors).

**Out:**
- "Publish to Facebook" creates a post from the product (image, text, price, link/Messenger button). Linked back via `OfferingSocialLink`.
- Storefront and POS read the same catalog.

**Why not "post is the source":** posts are unstructured, editable and have no stock/variant data. **Why not "form only":** too much double entry. So the catalog is canonical, import-from-post removes the double entry, and publish-to-post covers the other direction. A seller with very many products uses bulk import once.

Rule: a PDF or price list is an **input to a draft**, never the live source.

## 7. Ads, courier, own rider (ADR-027, ADR-028)

**Ads (Phase 8, human-approved):**
- Start with "Boost this product post": choose budget, audience preset, duration → preview → seller approves → create via Marketing API using the seller's own ad account and payment method.
- Needs additional Meta permissions and review. Spend is always explicitly approved by the seller. No autonomous spending.
- Click-to-Messenger ads carry referral data, so the bot knows the product and campaign. Sales report attributes orders to campaigns.

**Courier (Phase 5):**
- Order → "Send to courier" (one click, or auto on confirm if the seller enables it) → consignment created → tracking id and label saved → status webhooks/polling update the order → customer is notified.
- Providers: Steadfast, Pathao, RedX behind one `CourierProvider` port. Credentials per organization, encrypted.
- **Address validation before booking:** normalize the address. Map district/thana/area to each courier's own area IDs (Pathao needs city/zone/area). Check phone format. Show problems to the seller before calling the API, so bookings do not fail.
- Non-technical setup: guided wizard with screenshots per courier, "Test connection" button, and an assisted-setup option where our team does it for the seller on request. (Courier accounts and API keys belong to the seller's own merchant account.)
- COD: expected cash recorded, courier settlement reconciled against orders.

**Own rider (Phase 5):**
- `Rider` is a staff role. Assign orders to a rider, mobile PWA view for the rider (list, map link, call, mark delivered/failed, collect COD cash), cash handover to cashier, rider settlement report.

**Risk check:** COD risk score (return history by phone, area, order value) can hold an order for manual review.

## 8. Website CMS and platform-controlled design (ADR-029)

Goal: tenant websites must not all look alike, and the platform owner controls design from top to bottom without coding.

- **Design tokens:** colors, typography, spacing, radius, shadows, button styles, card styles, as a token set. A **Theme** = tokens + component variants.
- **Section library:** hero, product grid, category strip, testimonials, FAQ, contact, plans, menu, schedule, etc. Each section has several **variants** and settings. Sections available to a tenant depend on its enabled modules.
- **Templates:** a template = ordered pages, each an ordered list of sections with default content and a theme. Platform admins build and publish templates (visual builder in `apps/platform`), for each industry. Many templates per industry to avoid sameness.
- **Control levels:** each template region is `locked`, `editable-content-only`, or `fully-editable`. The platform decides what tenants may change (content, images, colors from an allowed palette, section order, add/remove sections within limits).
- **Tenant editing** (`apps/admin`): choose a template → edit content, theme options and sections within allowed limits → preview on mobile/desktop → publish. Versioning with rollback.
- **Rendering:** `apps/storefront` renders from the page JSON + theme tokens (server-rendered, cached, CDN). No tenant code ever executes on the server. Custom CSS is a plan-gated, sanitized feature or does not exist at launch.
- **Performance:** each tenant site must meet the LCP budget; images are resized/WebP via CDN.

## 9. Existing website sellers: connection policy (ADR-025)

- We never require code changes on the seller's site and never ask for access to it (security).
- Integration points are: catalog import, optional chat widget (their choice), optional API key to push products later.
- The seller's Page and WhatsApp work with banijjik's catalog regardless of the website.

## 10. Open questions for the owner
1. Do we offer an assisted-setup service for courier/Meta (human does the wizard for a fee or free)?
2. LLM provider and per-plan monthly AI message limits.
3. WhatsApp: which BSP/Tech Provider path (direct Cloud API vs partner)?
4. First courier to implement (recommended: Steadfast).
