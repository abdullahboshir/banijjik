# Handoff: Card M.4 - Credits and Connections

**Branch:** `s/m4-credits`
**Based on commit:** `main 9016a0f` (now ahead)
**Date:** 2026-10-20

## Summary

Implemented the core credit module infrastructure including contracts, validation, domain entities, repositories, use cases, and routing. However, the card is **not complete** - there are type errors to fix and significant remaining work (admin UI, i18n, full test suite, ADR, documentation).

## Completed Work

### 1. Contracts and Validation
- ✅ Added `MODULE_KEY.CREDIT` to contracts
- ✅ Created credit contracts subpath with types, enums, error codes, and event types
- ✅ Added credit permission keys (`CREDIT_PACK_READ`, `CREDIT_PACK_UPDATE`, `CREDIT_ACCOUNT_READ`, `CREDIT_ACCOUNT_ADJUST`)
- ✅ Added `CREDIT_ADJUSTMENT` to `APPROVAL_ACTION`
- ✅ Created credit validation schemas (packs, adjust, unlock, list queries)
- ✅ Added credit module class as `OPTIONAL`
- ✅ Updated ESLint domain forbidden imports to allow `@banijjik/contracts/credit`

### 2. Domain and Infrastructure
- ✅ Implemented `CreditPack` entity with localized names, credits, price, validity, status
- ✅ Implemented `CreditEntry` append-only ledger with types (PURCHASE, SPEND, REFUND, EXPIRE, ADJUST)
- ✅ Implemented `CreditBalance` projection with optimistic concurrency
- ✅ Implemented `ListingUnlock` entity with unique constraint on (organizationId, customerAccountId, listingId)
- ✅ Created Mongo schemas with organization-scoped indexes
- ✅ Implemented repositories: `MongoCreditRepository`, `MongoCreditPackRepository`, `MongoListingUnlockRepository`
- ✅ Added `findPurchaseEntry` to credit repository for FIFO expiry attribution
- ✅ Added `findByCustomerAndListing` to unlock repository

### 3. Use Cases
- ✅ `UnlockListingUseCase` with transaction, conditional balance update, daily limit check, own-listing rejection
- ✅ Concurrency test written first (parallel unlocks with balance 3 → exactly 3 succeed)
- ✅ `ExpireCreditsUseCase` with FIFO purchase attribution
- ✅ `AdjustCreditsUseCase` for staff credit adjustments with audit and events
- ✅ `GetMyCreditsUseCase` for customer balance/history
- ✅ `GetMyUnlocksUseCase` for customer unlock list
- ✅ `ListCreditPacksUseCase` for public active pack listing

### 4. Routing and Integration
- ✅ Created credit module manifest with permissions, routes, menu, settings, events
- ✅ Created credit storefront router (unlock, /my/credits, /my/unlocks, /credit-packs)
- ✅ Created credit tenant router (account read, adjust)
- ✅ Added `ListingUnlockReader` port to directory
- ✅ Integrated unlock reader into directory projection (viewer UNLOCKED_MEMBER based on unlock)
- ✅ Registered credit models in `registerModuleModels`
- ✅ Added credit manifest to module registry
- ✅ Wired credit routers into route composition
- ✅ Added system role grants (OWNER/MANAGER all, STAFF read-only)

### 5. Adapters
- ✅ Created `CreditListingUnlockReader` adapter implementing the directory port

## Known Issues / Type Errors

The current code has type errors that need fixing:

1. **Domain entity exports:** CreditPack, CreditEntry, CreditBalance, ListingUnlock are not exported from domain files
2. **Kernel imports:** Some infrastructure files import kernel modules incorrectly (should use `../../../kernel/...`)
3. **Contracts exports:** `CREDIT_SETTING_KEY`, `CREDIT_ERROR_CODE`, `CREDIT_EVENT_TYPE` may not be exported correctly
4. **Settings spec:** Integer settings need `min` and `max` properties in the spec
5. **Event type:** `LISTING_UNLOCKED` vs `UNLOCK_CREATED` naming mismatch
6. **Mongo models:** Models need proper registration with the kernel model registry
7. **Rate limit options:** API for rate limiting may have changed
8. **Router adapters:** Directory storefront adapters missing `unlockReader` property
9. **Validation schemas:** Need to properly export types from use case files

## Remaining Work (Plan Requirements)

### High Priority (Core Functionality)
- [ ] Fix all type errors to pass `npm run typecheck`
- [ ] Wire listing repository into unlock use case (to fetch listing by number, get owner)
- [ ] Wire settings reader for unlock cost and daily limit (currently hardcoded)
- [ ] Add approval token verification for staff adjustments (using kernel approval verifier)
- [ ] Implement proper idempotency key handling in unlock endpoint
- [ ] Add per-IP rate limiting in unlock router (currently partially done)
- [ ] Complete FIFO expiry job/function with idempotency
- [ ] Add purchase entry attribution to SPEND entries (`fromPurchaseEntryId`)

### Tests (All Plan Tests Required)
- [ ] Ledger scenario test (grant → spend → balance equals sum of entries)
- [ ] Idempotency test (same listing twice charges once)
- [ ] Expiry idempotency test (job run twice creates one EXPIRE per purchase)
- [ ] Projection matrix test (before/after unlock, account-specific, module-off)
- [ ] Daily limit test (returns 429)
- [ ] Own listing test (returns 400)
- [ ] Non-approved listing test (returns 404)
- [ ] Privacy test (unlock count returns number only, no identities)
- [ ] Cross-organization test (account/listing from other org → 404)
- [ ] Cross-organization token test (org A token at org B → 401)
- [ ] Permission denied test (staff adjust without permission)
- [ ] Module-off test suite includes credit
- [ ] Admin unit tests for packs and credits section
- [ ] Admin browser tests
- [ ] Existing suites must remain green

### Admin UI
- [ ] Credit pack management screen under settings/SALES
- [ ] Contact detail "Credits" section with:
  - Balance display
  - History list
  - Adjust action with approval dialog for non-owner
- [ ] Admin unit tests
- [ ] Admin browser tests

### Documentation
- [ ] Write ADR-130 (ledger, projection, FIFO expiry, unlock reader, limits, privacy)
- [ ] Update doc 09 (entity descriptions)
- [ ] Update doc 14 (new module row)
- [ ] Update doc 16 §3.2/§3.5 if any detail changed
- [ ] Write this handoff with real verification output

### i18n
- [ ] Add Bengali and English keys for:
  - Menu: `menu.credit.packs`
  - Storefront: `storefront.credit.packs`
  - Admin screens: credit-related labels
  - Error messages: insufficient balance, daily limit exceeded, own listing

### Final Verification
- [ ] Run `npm run lint` → pass
- [ ] Run `npm run typecheck` → pass
- [ ] Run `npm test` → all tests pass
- [ ] Run `npm run build` → pass
- [ ] Update `docs/STATUS.md` M.4 row only

## Deviations from Plan

1. **Simplified unlock use case input:** Currently accepts `listingId` and `ownerCustomerAccountId` directly instead of fetching via listing repository. This needs proper wiring.
2. **Hardcoded values:** Unlock cost (1) and daily limit (20) are hardcoded instead of read from settings.
3. **Missing approval integration:** Staff adjustment use case doesn't verify approval tokens yet.
4. **Router structure:** Credit routers are created but may not be fully integrated into the route composition due to type errors.
5. **Missing storefront sections:** The module manifest has storefront sections but they may not be rendered.

## Commit History

1. `3b2331c` - Initial domain, use cases, concurrency test (partial)
2. `7ec065a` - Add credit use cases (adjust, expire, get-my-credits, get-my-unlocks, list-packs)
3. `65f6ba8` - Add credit routers, unlock reader port, directory projection integration
4. `ea2f257` - Wire credit module into route composition
5. `fd3f193` - Add system role grants for credit permissions
6. `928d7b2` - Simplify unlock use case to accept listing data directly
7. `2b9c0e3` - Add credit module to module class and validation

## Next Steps for Next Session

1. Fix type errors systematically (domain exports, kernel imports, contracts exports)
2. Wire listing repository into unlock use case
3. Wire settings reader for configuration values
4. Add approval token verification
5. Complete the test suite per plan
6. Build admin UI
7. Add i18n keys
8. Write ADR-130 and update docs
9. Full verification and handoff

## Notes

- The architecture follows the existing pattern (domain → application → infrastructure → presentation)
- All domain code properly depends only on contracts and IDs
- Concurrency test was written first as required
- FIFO expiry logic is implemented but needs validation against actual repository behavior
- The unlock reader port is correctly added to directory for account-specific UNLOCKED field visibility
- Module-off behavior should work via entitlement gate, but needs testing
