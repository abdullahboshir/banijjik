# Manoxen Port Map

Card D8 · Status: **draft, waiting for owner approval** · Written 2026-10-09 · Based on `s/D3-offerings-requests` (`7af39c5`) and manoxen `main` at `3ebafc55`

This doc says, for every banijjik module, what to take from manoxen (logic, rules, tests), how to map it to the new model, and what to leave behind. PLAN sessions for Phase 0–5 cards read their row here before reading manoxen code. Nothing is ported that is not listed here. Anything not listed stays in manoxen (archive) until a future card asks for it.

Inputs:
- `01 §8` (porting method), `09` (model), `10` (modules), `11` (lifecycles), `08 §8` (bot port list)
- AGENTS.md "Porting from manoxen"
- A size/test inventory of manoxen (below)

New decisions: §7 (ADR-069 to ADR-071).

Manoxen root: `E:\WEB-DEVELOPMENT\PROJECTS\business-platform\manoxen`. Paths below are relative to `apps/backend/src/contexts/` unless they start with `apps/`, `packages/` or `__tests__/` (= `apps/backend/__tests__/`).

---

## 1. How to port (every card)
1. Read this row, then the listed manoxen files and tests. Do not browse the rest of manoxen.
2. Write down the **rules** the code implements (in the plan file): invariants, edge cases, numbers. Port rules and tests, **not** files, folder structures or class shapes.
3. Map names and scope:
   - `businessUnitId`/`outletId` → `locationId`
   - `Customer` → `Contact` (+ roles)
   - `Product` → `Offering` (kind PRODUCT)
   - `sellerId`/`tenantId` → `organizationId`
   - ObjectId refs → domain UUID v7 refs
   - float money → Money minor units
   - `Number` qty → integer in unit precision
4. Re-implement in the target anatomy (`01 §2`), behind manifests (`10`), with the lifecycles of `11`.
5. Port each relevant test as a behaviour spec (rename to banijjik terms). A manoxen test that encodes a scope/BU rule is dropped, with a one-line note in the handoff.
6. List in the handoff: rules ported, tests ported, tests dropped (why), and known manoxen bugs not carried over.

**Never port** (global): any scope/BU/outlet code (`queryContext` scope modes, `UserBusinessAccess`, `contextScopePlugin`, scope inference), frontend shell/layouts/route groups, watchdogs and DOM guards, per-industry capability flags (`industry-capabilities.ts`), the double `auth()` mounts, retail-phrase chatbot libs, ad-hoc `console.*` logging, raw `_bypassContext`.

## 2. Inventory (what exists in manoxen, 2026-10-09)

| manoxen area | src files | LOC | tests | Port value |
|---|---|---|---|---|
| `platform/communication` (chat, inbox, bot, SMS, WhatsApp) | 577 | 127.6k | 156 (in-tree) | High, but selective (§4.7) |
| `core/organization` | 401 | 30.4k | 26 | Low (hierarchy model replaced) |
| `modules/sales` | 288 | 30.2k | 53 | High |
| `core/iam` | 236 | 18.8k | 15 | Medium |
| `modules/catalog` | 243 | 23.1k | 20 | High |
| `modules/supply` + `modules/inventory` | 195 | 20.6k | 16 | High |
| `modules/accounting` + `modules/finance` | 163 | 15.3k | 16 | High |
| `modules/analytics` | 62 | 10.0k | 15 | Medium |
| `platform/system` | 88 | 8.5k | 5 | Medium (ops) |
| `modules/membership` (= loyalty wallets/cashback, **not** gym membership) | 87 | 7.5k | 12 | Later (loyalty) |
| `modules/pos` | 72 | 5.2k | 6 | Medium |
| `modules/contacts` | 49 | 4.1k | 4 | Medium |
| `modules/logistics` | 47 | 3.7k | 2 | High (courier adapters) |
| `modules/storefront` + `modules/portal` | 71 | 5.7k | 1 | Medium |
| `modules/pricing` | 24 | 3.1k | 7 | High |
| `platform/ai` | 24 | 2.5k | 0 | High (gateway) |
| `platform/automation` (outbox) | 10 | 1.3k | 1 | High |
| `modules/hrm`, `crm`, `marketing`, `voice`, `link-hub`, `support`, `marketplace`, `corporate`, `legal`, `core/governance` | ~370 | ~27k | ~7 | Not in launch scope (`02` "out of scope") |
| `apps/frontend`, `apps/pos`, `apps/web` | — | — | — | Ideas only (no code) |

## 3. Kernel & packages (Phase 0–1)

| banijjik target (card) | Take from manoxen | Rules to keep | Change / drop |
|---|---|---|---|
| `kernel/db` `withTransaction()` (0.4) | `shared/infrastructure/transactions/with-financial-transaction.ts` + `__tests__/shared/with-financial-transaction.spec.ts` | all-or-nothing writes, retry on transient transaction errors | drop finance-specific naming; one generic helper |
| `kernel/idempotency` (1.5) | `shared/infrastructure/transactions/finance-idempotency-key.model.ts`, `modules/sales/application/lib/order-create-idempotency.lib.ts`, `modules/catalog/application/lib/product-create-idempotency.lib.ts` | key + **input hash** (same key, different body = 422), scope by org, replay returns the stored response | one middleware for all modules instead of per-module libs |
| `kernel/events` outbox (1.5) | `platform/automation/outbox/platform-outbox.ts` (+ `platform-outbox-context.test.ts`) | write outbox in the same transaction, dispatch after commit, DLQ on repeated failure | envelope per `05` (UUID v7 `eventId`, `version`) |
| Money VO in `@banijjik/contracts` (0.4) | `packages/contracts/src/value-objects/money.vo.ts` | integer minor units, allocation (largest remainder), currency guard | keep pure, no runtime deps |
| Phone canonicalization (0.4, used by 1.1/3.1) | `core/iam/.../user.model.ts` + mapper (`phoneCanonical`) | BD normalization `01…`/`+8801…` → E.164 | becomes a pure util in `kernel` + Zod transform |
| Error capture / observability (0.4, 6.5) | `platform/system` error log + rule 19, `__tests__/shared/post-ops-alert.spec.ts` | central capture, no empty catch, queue failure capture | no module-specific error tables |
| Tenant isolation tests (1.3) | `__tests__/tenant-kernel.spec.ts`, `tenant-kernel.matrix.spec.ts`, `__tests__/data-isolation/` | the **matrix approach** (every model × read/write × foreign org) | replace BU/outlet axes with location axis |
| Backups (6.5) | `__tests__/system/database-backup.spec.ts` + its service | scheduled backup + restore test | target infra decided in P6 |

## 4. Modules

### 4.1 Identity & organization (Phase 1)
| banijjik | manoxen source | Keep | Drop / change | Effort |
|---|---|---|---|---|
| `iam` (1.1, 1.4) | `core/iam` (auth use cases, JWT/refresh services, password policy, permission resolution + cache), `__tests__/iam/*` (15) | refresh rotation + reuse detection, password hashing policy, permission cache with version invalidation, login rate limits | role archetypes/portal types, UBA scope inference, platform flags on User (→ `PlatformOperator`), header-based context | M |
| `organization` (1.2) | `core/organization` (org provisioning, slug), `__tests__/organization/*` (26) | atomic org creation, slug generation/uniqueness, owner invariants | **rewrite**: BU/outlet hierarchy, slots/provisioning, industry merge, simple-mode hiding. Read the tests only for org-level invariants. | M (rewrite) |
| `entitlement`/`package` (1.6) | platform entitlement code, guide 45/47 (ideas) | entitlement-before-permission ordering | manoxen capability flags + provisioning slots → `10` resolver | rewrite |

### 4.2 Contacts & catalog (Phase 3)
| banijjik | manoxen source | Keep | Drop / change | Effort |
|---|---|---|---|---|
| `contact` (3.1) | `modules/contacts`, rule 11, `__tests__/contacts/*` (4), shared `BulkImportModal` flow (FE idea) | phone-first dedupe/link, walk-in handling (→ null `contactId` on POS orders), bulk import with dedupe, POS limited-create fields | `CustomerScopeAssignment`, BU lineage → `homeLocationId`, Customer → Contact + roles, `storeCreditBalance` field → `StoreCreditEntry` ledger | M |
| `catalog` (3.2) | `modules/catalog` (product, variant, unit, category, brand, attributes, import), `__tests__/catalog/*` (20), guide 18 (unit/bulk/variant UoM) | variants, units with precision, bulk import pipeline, barcode/SKU uniqueness, product-create idempotency | product-type-per-industry forms (guide 47) → kinds + custom fields; BU scoping → `OfferingLocation`; brand/attributes → custom fields unless D4 needs them | L |
| `inventory` (3.3) | `modules/supply`, `modules/inventory`, `__tests__/supply/*` (8), `__tests__/inventory/*` (8), `__tests__/system/stock-jobs.memory.spec.ts` | stock ledger invariants, transfer lifecycle (`stock-transfer-lifecycle.spec`), GRN/receipt line invariants, cancel guards, purchase return unit price | FIFO batches, bin locations, serials, cycle counts (later), landed-cost/PPV (later); **costing = moving weighted average** (ADR-069) | L |
| `pricing` (3.4) | `modules/pricing` (discount policy resolver/enforcer/cascade, `max-promotional-discount-for-line`, fixed MRP, margin), `__tests__/pricing/*` (7), guide 16, sales `document-line-tax.spec`, `order-tax-mismatch-guard.spec`, `discount-cap-metrics.spec` | discount caps, policy precedence, per-line tax, MRP ceiling | BU cascade → org → location; manager approval via `11 §9` | M |

### 4.3 Sales, returns, payments, accounting (Phase 3)
| banijjik | manoxen source | Keep | Drop / change | Effort |
|---|---|---|---|---|
| `sales` orders (3.5) | `modules/sales` (`order-status-transitions.lib.ts`, `order-status-path`, fulfillment state/timing libs, totals recalc, edit/amend policies, reservation, fraud gate), `__tests__/sales/*` (53) | edit/amend rules after confirm, totals recalc invariants, reservation then commit, revenue timing, collect/receivable policies, list pagination after match | statuses remapped to `11 §4`; delivery challans, e-invoice, commission, quotations, price lists (later); restaurant tables (Phase 7); `sourceModule` split POS vs commerce → `fulfillment.method` | XL (split 3.5a orders, 3.5b fulfillment) |
| `sales` returns (3.5) | `modules/sales/application/services/sales-return.service.ts`, guide 15, `assert-sales-return-window.spec`, `credit-note-remaining.spec`, `cap-approval-jwt-nonce.spec`, `finance/application/lib/sales-return-wire3-lines.ts` + `sales-return-wire3-invariants.spec` | the 25-row update matrix (reduced to `11 §6`), refund caps, due-first refund, damaged disposition, reversal, approval nonce single-use | credit notes → `StoreCreditEntry`; commission and membership hooks (later); manager PIN JWT → `11 §9` token | L |
| `payment` (3.8) | `modules/finance` (customer payments, AR), `__tests__/finance/*`, `order-receivable-policy.spec`, `order-collect-policy.spec` | allocation rules, receivable computation, overpayment handling | price lists, supplier bills (later) | M |
| `accounting` SYSTEM (3.8) | `modules/finance/application/handlers/wire-journal-handlers.ts`, `modules/accounting` (COA seeder, `coa-resolver.service.ts`, account/journal services), `__tests__/accounting/*` (14) | **resolve accounts by system code, not name**; journal reversal; trial balance; idempotent posting | posting rules rewritten to the `11 §10` matrix; fiscal year close → `bookkeeping` (3.8b) | L |
| `expense` (3.8) | `modules/accounting` expense workflow, `expense-workflow-fixes.memory.spec`, `operating-expense-accounting-method.spec`, guide 10 | posting expenses to category accounts, cash-basis note | approval chains (later) | S |
| `bookkeeping` (3.8b) | accounting reports, `trial-balance-year-close.spec`, `fiscal-year-close.memory.spec`, `journal-reversal.spec`, `account-opening-balance.memory.spec` | statements, opening balances, year close | cash notes (later) | M |
| `pos` (3.9) | `modules/pos` (terminals, shifts, registers, held orders, Z-report), `__tests__/pos/*` (6), `pos-shift-refund-bucket.spec`, guide 20 (Z-report reconciliation), `apps/pos` (UX ideas only) | shift open/close, expected cash incl. refunds, Z-report totals, held carts | industry POS modules (`apps/pos/src/modules/*`) → one POS over kinds; device ↔ location binding | M |
| `report` (3.10) | `modules/analytics` (EOD reports, KPIs), `__tests__/analytics/*` (15), `dashboard-delivered-kpi.spec`, guide 30 (daily EOD report) | KPI definitions (net sales after returns, delivered counts), EOD report content | in-memory aggregation → pre-aggregated daily summaries (events) | M |

### 4.4 Website (Phase 4)
| banijjik | manoxen source | Keep | Drop / change | Effort |
|---|---|---|---|---|
| `website` (4.1–4.5) | `modules/storefront` (public catalog API), guide 38 (web CMS page builder), `apps/web` (ideas) | public catalog browse API shape, server-side re-pricing (`sales/application/lib/resolve-public-order-line-items.lib.ts`) | `apps/web` code; theme/section model → `06 §8` + ADR-029 | M |
| `contact` CustomerAccount (4.3) | `modules/portal` (OTP auth, member views), guide 39 | OTP flow, rate limits | member/guardian portal views → later; token audience per ADR-045 | S |

### 4.5 Fulfillment & integrations (Phase 5)
| banijjik | manoxen source | Keep | Drop / change | Effort |
|---|---|---|---|---|
| `courier` (5.2) | `modules/logistics/application/adapters/{steadfast,pathao,redx}.adapter.ts`, `courier-adapter.factory.ts`, `ports/shipping-provider.port.ts`, `__tests__/logistics/*`, `logistics-order-sync.spec`, `docs/steadfast-chat-order-automation-handoff.md` | provider request/response mapping, status mapping, webhook handling, area mapping | factory → `CourierProvider` port registry; credentials encrypted per org; settlements → `CourierSettlement` | M |
| `delivery` own rider (5.3) | guide 21–23 (sell delivery workflow, smoke checklist, gaps) | delivery queue ideas, COD collection steps | challan documents | S |
| `sms` (5.13) | `platform/communication` SMS use cases (`send-bulk-sms`, templates), `bulk-sms-bd-errors.lib.ts` | BD SMS provider error mapping, templates | campaign tooling → later (`marketing`) | S |
| `payment-gateway` (5.17) | none usable for tenants (platform billing only, guide 45) | — | new | — |

### 4.6 AI gateway (Phase 5)
| banijjik | manoxen source | Keep | Drop / change | Effort |
|---|---|---|---|---|
| `ai` SYSTEM (5.7) | `platform/ai/infrastructure/adapters/*` (`openai-llm-gateway`, `gemini-chat-http`, `groq-chat-http`, `openrouter-chat-http`, `provider-fallback-chat`, `org-ai-key-resolver`), rule 22 | provider adapters, fallback chain, key resolver port, error formatting | business tool definitions stay outside (`08`) | S |

### 4.7 Messaging & bot (Phase 5): the selective port
Source: `platform/communication` (577 files, 156 tests). Rule: port the **generic machinery** (`08 §8`), never the phrase/product logic.

| banijjik | Take | Leave behind |
|---|---|---|
| `messaging` (5.4, 5.5, 5.12) | `ingest-inbound-message.use-case.ts`, `ingest-messenger-page-echo.use-case.ts`, `send-conversation-reply.use-case.ts`, `edit-delete-conversation-message.use-case.ts`, Meta clients (`meta-comment.client.ts`, `meta-content.client.ts`), WhatsApp Cloud client (`whatsapp-cloud.client.ts`), webhook signature + rate-limit fixes (PRs #115, #119), message dedupe, conversation/message models (→ `09 §5.7`) | EOD adapters (→ notification later), campaign adapters (→ marketing later), WhatsApp worker/gateway factory unless needed |
| `bot` (5.6–5.9) | `chat-agent.use-case.ts` (tool-calling loop), `chat-agent-tools.lib.ts` (**pattern only**: tools are re-defined per `08 §2`), `chat-agent-circuit-breaker.lib.ts`, `ai-chat-budget.lib.ts` / `chat-ai-budget.lib.ts`, `chat-semantic-retrieval.lib.ts` + `catalog-embedding-refresh.lib.ts`, `bangla-transliterate.lib.ts`, `bangla-glyph-fold.lib.ts`, `guard-ungrounded-money-claims.lib.ts` + `guard-ungrounded-stock-claims.lib.ts` (→ one grounding guard), `chat-reply-dedupe.lib.ts`, `chat-human-timing.lib.ts`, `chat-handoff-reply.lib.ts`, `chat-inbound-rate-limit.lib.ts`, `chat-order-slots.lib.ts` (→ `botAsk` intake), `parse-order-from-message.use-case.ts` (→ `create_request` extraction) | `catalog-query-synonym-groups.data.ts` (→ per-org synonym data), `catalog-vague-oil-hint`, `build-combo-swap-reply`, `answer-combo-offer-query`, size-token hacks, price-bargain/persuasion builders, `ambiguous-chat-intent`, `chat-intent-gate` pre-gate NLU, `aiFirst` branches, `money-bargain-pending-gate`, every `*-shape.lib.ts` phrase detector |
| `bot-evals/` goldens (D5, 5.6) | the 156 in-tree tests and `docs/messenger-chatbot-handoff-note.md` failure cases, **converted to golden conversations** (customer turns → expected tools/states/claims), not ported as unit tests | tests that assert exact Banglish wording or regex routing |

### 4.8 Ops & system (Phase 6)
| banijjik | manoxen source | Keep | Effort |
|---|---|---|---|
| ops runbooks (6.5) | `docs/runbooks`, `docs/DEPLOY_HOSTINGER_VPS.md`, `docs/RELEASE-GUIDE61-PRODUCTION.md`, `README_DEPLOY.md` | deploy steps, backup/restore drills, release checklist | S |
| security/perf hardening (6.3, 6.4) | `docs/ATOMICITY-ZERO-FAILURE-AUDIT.md`, `docs/FRONTEND-SECURITY-ACCESS-AUDIT.md`, guides 24/28 (perf lessons) | checklists as review inputs (not code) | S |
| SaaS billing (6.2) | platform billing code, guide 45 (checkout testing runbook) | gateway checkout flow and test runbook | M |

## 5. Not ported at launch (stay in manoxen / archive)
HRM/payroll/attendance devices (`modules/hrm`, `apps/biometric-gateway`), CRM leads, marketing campaigns, link-hub, voice dialer, support, marketplace, corporate/legal/governance, loyalty membership/cashback (`modules/membership`), commission, quotations, delivery challans, e-invoice, bank reconciliation, supplier bills/landed cost, FIFO batches/bins/serials. Each can return later as its own card with a row added here.

## 6. Order of porting = roadmap order
Phase 0–1 kernel rows (§3) → 1.1/1.2/1.4 (§4.1) → 3.1–3.10 (§4.2–4.3) → 4.x (§4.4) → 5.x (§4.5–4.7) → 6.x (§4.8). A PLAN session that finds manoxen logic contradicting `09`/`11` follows banijjik docs and lists the contradiction in its plan.

## 7. Decisions made in this card

| ADR | Decision | Status |
|---|---|---|
| ADR-069 | Inventory costing = **moving weighted average cost** per `(location, variant)`, updated on each stock-in. COGS at commit uses the current average. Manoxen's FIFO batches are not ported. Returns restock at the original line cost stored on the order line (`unitCostSnapshot`, added to `09` Order lines). | Accepted (proposed) |
| ADR-070 | Porting rule: port **rules and tests, not files**. Each card reads only its row in `15-PORT-MAP.md`. Manoxen tests encoding scope/BU behaviour are dropped with a note. Manoxen chatbot unit tests become golden conversations, not unit tests. | Accepted (proposed) |
| ADR-071 | Manoxen `modules/membership` (loyalty wallets/cashback) is unrelated to banijjik `enrollment` (PLAN kind) and is not ported at launch. Loyalty can return later as an OPTIONAL module. | Accepted (proposed) |
