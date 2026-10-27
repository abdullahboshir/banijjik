# Phase 4 planning map: tenant websites

Planner: Codex · 2026-10-27 · Based on commit: `016bd228ec92a40d65179dc8db1132184adab983`

## Authority and readiness

The owner explicitly requested plans for **every Phase 4 card in this session**. This is a planning-only exception to the one-card / rolling-wave rule, not authorization to implement future dependencies early. Plans are written against the pinned checkout above. None is independently approved. Before implementation, refresh each part against merged dependencies; a different tool must check every T1 plan (RUN-WITHOUT-CLAUDE §4.3). Do not claim that this planner's self-check is that independent check.

Owner answers, 2026-10-27:
- Guest checkout is required alongside the existing customer phone-OTP sign-in.
- 4.6 is folded into 4.3; do not build a second booking website.
- The planner may select the custom-domain provider. Select Cloudflare for SaaS behind a provider port; accounts, zone and credentials remain deployment prerequisites.
- Bring the **full COD lifecycle** into Phase 4. This adds explicit prerequisite parts for shipping, failure, redelivery, return-to-sender, collection, settlement and their accounting. Provider API automation remains 5.2; rider mobile operations remain 5.3. Staff can execute the complete lifecycle in Phase 4.

All parts are planned, not implemented. Do not mark a card implementation-ready until its refresh and applicable plan check pass. ADR-P4-A through ADR-P4-D below are proposed architecture decisions; allocate numeric ADRs on integration, since other planning branches are active.

## Mission and boundaries

One codebase and generic Offering kinds; template data produces industry differences. A phone user sees a simple website and a small editor. Each business owns a design snapshot; a template update changes no existing site. The admin/platform shells keep their own design. Server-side permission, entitlement, tenant/location, money and stock rules apply on every surface.

Reuse `apps/storefront`, `commerce/website`, customer accounts, shared validation, file variants, pricing, booking, enrollment, sales, payment and accounting. No second storefront app, CMS database, contact identity or financial ledger.

## Evidence and existing seams

Read: AGENTS; STATUS; LEAD-STATE; RUN-WITHOUT-CLAUDE; plans/_TEMPLATE; parallel-sessions-guide §§1–8; vision; architecture §§1–8; conventions; 06 §§3,8; 10 module/website/access tables; 11 §§4–11; 13 performance/mobile rules; 14 §§5.8,6; **only the Phase 4 source row** of 15 for legacy reference; ADR-029/031/045/114/119/144/149/150; 3.20 font plan.

Inspected implementation:
- contracts website, module manifest, sales statuses; website manifest, ports, site reader, page schema and public index.
- storefront routes, current-site, theme, host resolver, proxy, origin/path guards, layout.
- sales create/place ports and use cases; booking hold/create/request ports and use cases; enrollment create/ports/index.
- kernel MongoUnitOfWork/withTransaction: nested transactions join the surrounding session.
- resolver exposes storefrontSections, but not websiteTemplateKeys in its current resolved output.
- manoxen's mapped resolve-public-order-line-items.lib.ts: preserve the **re-read active catalog and server-price** invariant only. Its floats, industry flags, direct models, naming and permissive price inputs violate this project's rules and must not be copied.

## Cross-card issues resolved by these plans

| Observed issue | Planned treatment |
|---|---|
| Target docs say channel/website; shipped module is commerce/website | Keep the shipped path (ADR-P4-A); no move hidden in a feature card. Correct the ownership references when this proposal is accepted. |
| Website static pages already have key-based routes | Preserve ABOUT/FAQ/GUIDE/TERMS/PRIVACY/REFUND and their URLs. Layout pages use a separate route; publish snapshots include static text. |
| Manifest storefrontSections arrays are empty | Register real sections at their owning manifests in small integration parts, then derive availability from resolveOrgConfig. No industry switch in renderer. |
| Same-industry warning needs the industry key | Only platform/industry selects candidates; website receives opaque candidate IDs and compares fingerprints. |
| Existing layout reads customer cookies | Do not CDN-cache personalized HTML. Cache public projections only; 4.2 owns the explicit cache policy. |
| Existing site read is intentionally ungated | Preserve basic /site discovery. Published design and checkout have their own WEBSITE gates; no accidental break of Track M. |
| Orders currently reject COURIER/OWN_RIDER | 4.3-COD lands before COD checkout; declare and test the full transition/posting matrix. |
| Enrollment create can immediately activate | Add an explicit trusted customer-request mode that creates PENDING, without changing staff behavior. |
| Booking request checks deposits | A checkout that needs a deposit leaves HELD and reports payment required; never bypass the deposit guard. No gateway in Phase 4. |
| Guest phone is not verified identity | Never expose or attach an existing contact's records based on a submitted phone. Guest access is a separate opaque session. |
| Source docs disagree on Phase 3 gate | Require the Phase 3 reviewer/lead to reconcile closure before Phase 4 code merges; planning can proceed now. No inferred PASS from stale STATUS. |

## Cards, parts and sequence

| Plan | Tier | Parts / predecessor |
|---|---|---|
| [4.1](4.1.md) Theme engine | T1 | A1 contracts/validation → A2 persistence/policy → A3 publication/API → B renderer → C manifest integration |
| [4.2](4.2.md) Hosting and storefront runtime | T1 | A1 domain registry → A2 Cloudflare worker → B domain wizard → C SSR/cache/SEO; after 4.1 A3, renderer before C |
| [4.3-COD](4.3-COD.md) COD prerequisites, part of 4.3 | T1 | S sales → C courier manual records → R rider manual records → P collection/settlement → J accounting → B staff screens → V end-to-end; sequential cross-module review gates |
| [4.3](4.3.md) Public catalog and checkout | T1 | A1 public reads → A2 guest identity → A3 business command adapters → A4 checkout/ownership → B1 shop → B2 bookings/plans/tracking → V day scenarios |
| [4.4](4.4.md) Platform designer | T2 screens; T1 policy API | A1 template API → A2 industry compatibility/warnings → A3 operator site API → B builder; after 4.1 |
| [4.5](4.5.md) Tenant editor | T2 | A template adoption/preview → B editor/rollback; after 4.1, 4.4 API, 4.2 preview runtime |
| [4.6](4.6.md) Simple booking page | folded | Acceptance coverage in 4.3; no separate implementation |

Default execution is sequential. This file does **not** authorize parallel agents or expand the roadmap's parallel lanes. A lead may propose actual non-overlapping pairs in the roadmap after reviewing merged file ownership. New parts use their own branches/worktrees. A part with more than 15 T1 production files or 25 T2 files is split before implementation; shared registrations count toward the size.

4.1 first; 4.4 API next makes real design authoring available; 4.2 exposes it safely; COD prerequisites then 4.3; finish 4.4 screens and 4.5. Exact scheduling may change, but dependencies do not.

## Shared release and safety requirements

Every tenant collection uses the tenant plugin via models(ctx); audit fields, UUID v7, embedded _id:false, versioned mutable aggregates. Tenant indexes start with organizationId. Global host uniqueness uses an explicit platform routing record, not a cross-tenant repository bypass. No organizationId accepted in tenant request bodies.

Permission and entitlement gates are assembled once at routes; module routers receive configured guards. Platform actor authorization is distinct from customer/staff authorization. Staff-wide site changes require all-location authority; public requests validate against the site's allowed active locations and only pass that location to business commands.

Use the existing response envelope, validation and error conventions. New constants/types live in contracts subpaths first; schemas in validation subpaths. Changes to shared exports, routes, grants and catalogs are add-only. UI strings in BN/EN, tenant content uses LocalizedText, labels use resolved terms. No fake ratings/stock/testimonials.

Each implementation handoff lists actual command output, test names, deviations, CI URL and card:check. Local checks follow guide §7/§8, full lint/typecheck/test/build and browser suites run in CI. Docs-only planning verification is links/paths, template coverage, contract consistency and git diff --check; it is not a runtime test pass.

## Phase acceptance matrix

- Two businesses on one template have independently published designs; neither template edits nor another site's rollback changes them.
- Tenant cannot alter locked content, variants, structure, tokens or limits through a forged API request.
- Host A + path/account/file of B cannot reveal B; removed/unverified domains do not route; private responses never hit a shared cache.
- All five Offering kinds are browsable when enabled; PRODUCT order, SERVICE/RENTAL/EVENT booking and PLAN enrollment use existing business rules.
- Guest and signed-in checkout both work, including lost-response retry; guest identity cannot claim a known contact.
- Delivery → courier/rider collection → settlement and failure → redelivery / RTS have correct stock, dues, journals and reports after real outbox processing.
- Directory, credit, account, consent, erasure, protected photos and static pages from Track M still work.
- BN/EN, mobile 360/390/768 px, keyboard and 44 px targets pass; editor is lazy-loaded; LCP target <2.5 s, INP <200 ms and existing route budgets are measured, never waived here.
- Real Cloudflare staging ownership/TLS/removal smoke test completes before custom domains are called production-ready.
- A separate reviewer writes phase-4-review.md and reconciles docs/code drift before the pilot proceeds.

## Proposed architecture records (for docs/04-DECISIONS.md)

**ADR-P4-A — website snapshots and boundaries. Accepted (proposed).** Keep commerce/website as the implemented module. SiteDesign and immutable WebsiteVersion snapshots are the sole rendering contract. A template revision is copied on explicit adoption; current site policy is always enforced on restore. Platform templates belong to platform/industry for industry access; no feature module reads industry. Keep old static-page endpoints via a draft adapter and publish full snapshots.

**ADR-P4-B — domain routing. Accepted (proposed).** Cloudflare for SaaS is the first edge provider, selected under the owner's delegated choice. Use platform/operations for globally unique host claims; tenant SiteDomain rows hold business-facing state. DNS ownership, provider hostname state and TLS readiness are separate. Provider calls and invalidation go through durable jobs. Host-only customer cookies remain unchanged.

**ADR-P4-C — customer checkout. Accepted (proposed).** Owner approved guest checkout. Website orchestrates existing business modules through public command ports in one transaction; it owns checkout/access records only. Guest sessions cannot impersonate customer accounts or merge by phone. Mixed-kind checkout produces separate requests linked by checkoutId. Money/stock remain in their current modules.

**ADR-P4-D — launch scope amendment. Accepted (owner for scope; mechanics proposed).** Owner approved folding 4.6 into 4.3 and bringing full COD into Phase 4. Manual courier and rider operations use their target modules and real ledgers; Phase 5 adds providers/mobile workflows, not a second lifecycle. 4.3 is incomplete until COD reconciliation and failed-delivery scenarios pass.

## Follow-up input, not an invented approval

No further product choice is required for the drafted scope. Before implementation: independent T1 check and architecture proposal acceptance through the normal lead process; refresh against Phase 3 closure. Before live custom domains: owner supplies the Cloudflare zone, account capability, target hostname and credentials through validated configuration. No provider account was created or charged by this planning session.
