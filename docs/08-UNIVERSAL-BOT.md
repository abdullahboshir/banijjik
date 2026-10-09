# Universal Chatbot

Goal: one bot that sells and books for **any industry** (products and services) with **no per-industry or per-phrase code**. ADR-035.

Lesson from manoxen: the chatbot grew to ~576 lib files in `platform/communication/application/lib`. Many were retail-specific (combo swap, oil hints, synonym data) or Banglish regex/phrase patches, each added to fix one conversation. Fixes created new breakages, and services/bookings were unsupported. Banijjik does not repeat this.

---

## 1. Architecture

```
Channel adapter (Messenger / Instagram / WhatsApp / Web)  → normalized Message
  → Conversation state (structured)            ← generic state machine
  → Agent turn: LLM with tool calling          ← tools generated from resolveOrgConfig()
  → Grounding guard (facts must come from tool results this turn)
  → Reply composer (terms, tone, language)     → channel adapter send (via outbox)
```

The bot knows **offering kinds, tools and fields**. It knows nothing about gyms, salons or detergent.

## 2. Generic tools (generated per org from enabled modules and kinds)

| Tool | Available when | Purpose |
|---|---|---|
| `search_offerings(query, kind?, filters?)` | catalog | Hybrid search (text + embeddings + transliteration-normalized). Returns top-k. |
| `get_offering(id)` | catalog | Details, variants, price, custom fields visible to the bot |
| `check_stock(offeringId, variant?, qty, location?)` | PRODUCT kind | Stock truth |
| `check_availability(offeringId, dateRange/time, resource?)` | SERVICE / RENTAL / EVENT | Free slots |
| `get_plan_terms(offeringId)` | PLAN | Period, fee, start dates, capacity |
| `get_policy(topic)` | always | Delivery, returns, payment, hours, locations, FAQ (seller-written knowledge) |
| `quote(items/requests)` | sales / booking | Server-side price incl. delivery and active promotions |
| `create_request(kind, items, fields)` | sales / booking / subscription | Creates a draft Order / Booking / Enrollment / Reservation. Required fields come from config (`botAsk`). |
| `get_request_status(ref)` | any request module | Order / booking status, courier tracking |
| `handoff(reason)` | always | Pauses bot, routes to inbox |

Tool input schemas are **generated** from the kind schema + custom field definitions, so new fields need no bot code.

## 3. Conversation state machine (generic)

`idle → browsing → focused(offering) → qualifying(variant / slot / plan) → collecting(required fields) → confirming → created → after-sales`

- State is stored structurally: focus, cart/requests, collected fields, and the last tool facts. It is not reconstructed from transcript text.
- Transitions happen only through tool results or explicit customer confirmation. A price question never jumps to collecting address (a real manoxen failure).
- Collecting asks only for missing `botAsk` fields, one or two at a time, in the customer's language.

## 4. Language
- Bangla, English and Banglish come from the LLM plus **one generic** normalizer (transliteration and Bangla glyph folding) used for search.
- **No phrase lists, regexes or keyword routers in code** for understanding intent.
- Seller-specific vocabulary (brand nicknames, local product names) is **data**: per-org synonyms edited in the dashboard, used by search.

## 5. Safety and truth
- **Grounding guard:** every price, stock, availability, date, fee or policy claim in a reply must match a tool result from this turn. Otherwise the reply is blocked and regenerated, or handed off. This replaces manoxen's many per-case money-claim guards with one generic rule.
- "Not found" ≠ "unavailable". No price invention or negotiation. Promotions come only from active rules.
- Customer text is data, never instructions. Tools cannot change prices, stock, refunds or settings.
- Media: images go through product recognition via `search_offerings` with an image embedding. Voice goes through transcription, then the normal flow.

## 6. Cost (ADR-030)
Tier 0 rules/cache → small model → large model on low confidence. Top-k only. Prompt caching. Short outputs. Per-org quota; over quota → rules-only mode.

## 7. Quality without whack-a-mole: the eval harness (mandatory)
- **Golden conversations** are data files (`bot-evals/<industry-template>/*.yaml`): customer turns + expected tool calls, state transitions and claims, not exact wording.
- Each industry template ships with at least 20 golden conversations covering browse, price, stock/availability, collect, confirm, status, handoff and Banglish.
- CI runs the eval suite on every bot change. A bug fix = **first add the failing golden conversation, then fix the generic layer.** Never add a phrase-specific branch.
- Production traces (tool calls, state, guard decisions) are logged per turn. Failed conversations can be exported into new golden files.

## 8. What to port from manoxen
Port (generic): webhook intake + signature, message dedupe, inbound rate limit, budget/circuit breaker, Bangla transliteration/glyph fold, semantic retrieval + embedding refresh, human-timing/handoff, output guard concept, chat order slot logic (generalized into `botAsk` fields).
Do not port: product-family or phrase-specific libs (combo, oil, detergent, size-token hacks), regex intent routers, retail-only order slots, `aiFirst` pre-gate NLU branches.
