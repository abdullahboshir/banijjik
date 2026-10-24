# Plan: card M.7 · Trust and safety for directories

Tier: **T1** (privacy, account bans, erasure) · Planned by: Opus 5.5 (lead) · Date: 2026-10-23 · Based on commit: `main 88336672` · Reserved ADR: **ADR-134** (ADR-131 is taken by 3.5a; 3.6b moves to ADR-133)

Track M (`docs/16-MATRIMONY-TRACK.md` §3.5). The API parts do not wait for M.6: the storefront buttons (report, block, delete my account, download my data) are built in M.6 on these endpoints.

## What already exists (do not rebuild)
| Doc 16 §3.5 item | Where it is today |
|---|---|
| Account ban | M.1: `BlockCustomerAccountUseCase` (`contact.customerAccount.block`); a block deletes the sessions, sign-in is refused |
| Listing hide by staff | M.2/M.3: `HideListingUseCase` (`directory.listing.hide`) |
| Owner deletes the listing → anonymized | M.2: `ArchiveMyListingUseCase`, `Listing.archive()` clears fields, photos and consents |
| Consent text stored with the accepted version | M.2: `consentsAccepted[{ consentKey, textVersionHash, acceptedAt }]` |
| Scraping limits on unlocks and search | M.4: `credit.unlocksPerDay`; M.2: `DIRECTORY_SEARCH_RULES.perIp/perAccount` on `GET /listings` |
| Audit of moderation and credit actions | M.2–M.5 |

## What is missing (this card)
1. **Reports:** a customer reports a listing with a reason from the template; staff work a queue and resolve.
2. **A banned account's listing stays public.** Blocking an account does not hide its APPROVED listing.
3. **The listing detail endpoint has no rate limit.** Listing numbers are sequential (`<prefix>-1`, `-2`, …), so `GET /listings/:listingNumber` is the easiest way to copy every biodata. This is the main scraping gap.
4. **Blocks:** a customer hides a listing from their own search results.
5. **Self-erasure:** a customer deletes their whole account, not only the listing.
6. **Export of one's own data.**

## Session parts
| Part | Branch | Tier | Content | Starts |
|---|---|---|---|---|
| **A1, API** | `s/M.7-api-reports` | T1 review | missing items 1–3: decisions 1–8 | now |
| **A2, API** | `s/M.7-api-erasure` | T1 review | missing items 4–6: decisions 9–11 | after A1 merges (same directory router, manifest and contracts files) |
| **B, screens** | `s/M.7-ui-reports` | merge check | the admin report queue and report detail: decision 12 | after A1 merges |

Handoffs: `docs/handoffs/M.7-api-reports.md`, `M.7-api-erasure.md`, `M.7-ui-reports.md`. One STATUS row `M.7`; each part writes its own line in the note.

---

## Part A1: reports, banned account hides its listing, detail rate limit

### Decisions
1. **Report reasons are template data.** The template `directory` block gets `reportReasons: [{ reasonKey, label: LocalizedText }]`:
   - Zod: `reportReasons` defaults to `[]` (templates already stored have none), `reasonKey` matches `DIRECTORY_REASON_KEY_PATTERN`, keys are unique. Add the uniqueness check to `directoryBlockConsistent`.
   - With an empty list, filing a report answers 409 `directory.report.notConfigured`. There is no built-in reason in code (no domain words in code). M.8a seeds the reasons.
   - The tenant `GET /directory/config` response adds `reportReasons`. A new storefront `GET /listing-report-reasons` returns `[{ reasonKey, label }]` for the M.6 form.
2. **ListingReport** (directory module, organization scope, versioned, audit fields; collection `listing_reports`):
   - `listingReportId`, `listingId`, `reporterCustomerAccountId`, `reasonKey`, `note` (optional, trimmed, ≤ 500 chars)
   - `status`: `OPEN | RESOLVED`
   - `outcome`: `DISMISSED | WARNED | LISTING_HIDDEN | ACCOUNT_BLOCKED`, set on resolve
   - `resolvedByUserId`, `resolvedAt`, `resolutionNote` (≤ 500)
   - Indexes:
     - `{ organizationId, status, listingId, createdAt }` for the queue
     - unique partial `{ organizationId, listingId, reporterCustomerAccountId }` where `status: OPEN`. One open report per reporter per listing; a second POST returns the existing report, 200, not a new record.
     - `{ organizationId, reporterCustomerAccountId, createdAt }` for the daily cap
3. **Filing a report:** `POST /storefront/orgs/:organizationId/listings/:listingNumber/reports`, signed-in customer only (`authenticateCustomer`); anonymous reports are spam. Body `{ reasonKey, note? }`. Refused when:
   - the listing is not APPROVED → 404 (the caller cannot see it)
   - it is the caller's own listing → 409 `directory.report.ownListing`
   - the reason is not in the template list → 400 `directory.report.unknownReason`
   - the caller already filed `DIRECTORY_SAFETY_RULES.reportsPerAccountPerDay` (10) reports in the organization's business day → 429 `directory.report.dailyLimit`. Count with the reporter index, inside the same transaction as the insert.

   The listing owner never learns who reported; no response to the owner carries reports.
4. **Staff queue grouped by listing.** Staff judge a listing, not single reports.
   - `GET /orgs/:organizationId/directory/reports?status=OPEN&page&limit` (`directory.report.read`) is an aggregation over OPEN reports grouped by `listingId`, oldest first. Each item: `{ listingId, listingNumber, listingStatus, openCount, reasonKeys[], oldestReportAt, newestReportAt }`. Paginated, limit ≤ 100; the `$match` stage uses the queue index.
   - `GET /orgs/:organizationId/directory/listings/:listingId/reports?status&page&limit` (`directory.report.read`): the reports of one listing, `{ listingReportId, reasonKey, note, status, outcome, reporterCustomerAccountId, createdAt, resolvedAt, resolvedByUserId }`. Staff see the reporter's account id, never the reporter's phone in this response.
5. **Resolve:** `POST /orgs/:organizationId/directory/listings/:listingId/reports/resolve` (`directory.report.resolve`). Body: `{ reportIds: string[1..100], outcome, note? }`.
   - Only the listed OPEN reports of that listing are closed. A report filed after the staff member opened the screen stays OPEN. Unknown, foreign or already resolved ids → 409 `directory.report.stale`, nothing written.
   - Outcome effects, all in one `unitOfWork.run`:
     - `DISMISSED`, `WARNED`: no listing change. `WARNED` only records the outcome; the warning SMS comes in M.8 from the event.
     - `LISTING_HIDDEN`: needs `directory.listing.hide` as well (decision 6). An APPROVED listing is hidden through the same entity method and audit as `HideListingUseCase`. Already HIDDEN: no listing write, the reports still close. Any other status → 409 `directory.report.cannotHide` (staff choose DISMISSED).
     - `ACCOUNT_BLOCKED`: needs `contact.customerAccount.block` as well (decision 6). Blocks the listing owner's customer account through a contact port (decision 7). The listing is then hidden by the handler of decision 7, not here, so there is one path for "blocked account → hidden listing".
   - Each closed report gets `status RESOLVED`, the outcome, the actor and the time. Conditional update on `status: OPEN` and `version`; a lost race → 409 `directory.report.stale`.
   - Audit `LISTING_REPORTS_RESOLVED` with `{ listingId, outcome, count }`, no note text. Event `directory.listingReport.resolved` with `{ listingId, outcome, reportIds, ownerCustomerAccountId }` (no note, no reporter ids). `directory.listingReport.filed` with `{ listingId, listingReportId, reasonKey }` on filing.
6. **The second permission inside resolve** comes from a port, like catalog's `sensitiveAccess` (`routes/catalog-tenant-router.ts` `sensitiveAccessOf`): `moderationAccess: { mayHide(): Promise<boolean>; mayBlockAccounts(): Promise<boolean> }`, required, wired in `routes/directory-tenant-router.ts`. Missing → 403 `FORBIDDEN`, nothing written. Rules ask for permission keys, never roles.
7. **A blocked account's listing is hidden.**
   - Contact gains an exported port `buildCustomerAccountBlocker()` in `contact/index.ts`: `block({ organizationId, customerAccountId, actorUserId })`. It runs the existing block logic (same entity method, audit, event, session deletion), joins the open transaction, and is idempotent: already blocked → no write, no error.
   - Directory consumes `contact.customerAccount.blocked` with handler `directory.hideOnAccountBlocked` (`ordering: "UNORDERED"`). It finds the account's listing with `findActiveByOwner`:
     - APPROVED → HIDDEN, by the system: the actor is `null`, so `Listing.hide` accepts `UserId | null`. Audit action `LISTING_CONCEALED`, event `directory.listing.concealed`.
     - Any other status → no write. SUBMITTED and DRAFT are not public; a blocked account cannot sign in to change them.
     - A rerun does nothing twice: already HIDDEN means no write.
   - Unblocking does **not** unhide. Staff unhide by hand after checking.
   - Register the handler in `start-worker.ts` the way `registerAccountingAndExpenseHandlers` is registered. Directory's manifest lists the event in `events.consumes`. The handler runs inside the organization context, so settings resolve (3.19).
8. **Rate limit on the listing detail.** `GET /listings/:listingNumber` gets the same two `rateLimit` middlewares as `GET /listings` (per IP, then per account or IP), with their own buckets `directory.detail.ip` and `directory.detail.account`. The limits come from new `DIRECTORY_SEARCH_RULES.detailPerIp` and `detailPerAccount`: 60 per minute each, the same as search. Constants, not settings: abuse protection is platform policy.

### Files (Part A1)
| Path | Create/Change | Owns / add-only | Purpose |
|---|---|---|---|
| `packages/contracts/src/directory/listing-report.ts` | Create | owns | `LISTING_REPORT_STATUS`, `LISTING_REPORT_OUTCOME`, `DIRECTORY_SAFETY_RULES` (`reportsPerAccountPerDay: 10`, `reportNoteMaxLength: 500`), request/response types |
| `packages/contracts/src/directory/directory-event-type.ts`, `directory-settings.ts`, `directory-contracts.ts`, `index.ts` | Change | add-only | the two events, detail limits, `reportReasons` on `DirectoryConfigResponse`, exports |
| `packages/contracts/src/platform/industry-template.ts` | Change | add-only | `IndustryTemplateDirectoryReportReason`, `reportReasons` on the block |
| `packages/contracts/src/iam/permission-key.ts`, `audit/audit-action.ts`, the directory API message keys | Change | add-only | `DIRECTORY_REPORT_READ` / `_RESOLVE`, `LISTING_REPORT_FILED`, `LISTING_REPORTS_RESOLVED`, the error keys of decisions 1, 3, 5 |
| `packages/validation/src/directory/listing-schemas.ts`, `platform/industry-template-schemas.ts` | Change | add-only | report, resolve and queue schemas; `reportReasons` |
| `directory/domain/listing-report.entity.ts` | Create | owns | entity, `resolve()` transition |
| `directory/domain/listing.entity.ts` | Change | owns | `hide()` accepts `UserId | null` |
| `directory/application/ports/listing-report-repository.ts` | Create | owns | port |
| `directory/application/use-cases/listing-report.use-cases.ts` | Create | owns | file, queue, list per listing, resolve |
| `directory/application/handlers/hide-on-account-blocked.handler.ts` | Create | owns | decision 7 |
| `directory/infrastructure/listing-report.schema.ts`, `mongo-listing-report.repository.ts`, `register-directory-models.ts` | Create/Change | owns | collection, indexes, registration |
| `directory/presentation/directory-storefront.router.ts`, `directory-tenant.router.ts` | Change | owns | routes, detail rate limit |
| `directory/index.ts`, `module.manifest.ts`, `README.md` | Change | owns | wiring, permissions, events, menu entry `directory.reports` (path `directory/reports`, permission `directory.report.read`) |
| `contact/index.ts` and one new application file for the blocker | Change/Create | add-only in `index.ts` | decision 7 port |
| `routes/directory-tenant-router.ts`, `routes/storefront.ts`, `start-worker.ts` | Change | add-only | wiring, handler registration |
| `packages/i18n` catalogs | Change | add-only | permission labels and the new error keys, BN and EN |
| `docs/04-DECISIONS.md` (ADR-134), `docs/14-API.md` rows, `docs/handoffs/M.7-api-reports.md`, STATUS row | Change/Create | add-only | records |

Part A1 has about 15 production files, the T1 limit. If it grows, stop and ask; do not merge decision 8 into another file to save a row.

### Tests (Part A1, must exist and pass)
- [ ] `files a report on an approved listing and returns it` (201); `returns the same open report when the reporter files again` (200, one row)
- [ ] `refuses a report on the caller's own listing`; `refuses an unknown reason`; `refuses when the template has no report reasons`; `answers 404 for a hidden, draft or archived listing`; `requires a signed-in customer`
- [ ] `stops the eleventh report of the business day`, with a fixed clock at 01:30 Dhaka time so the business day differs from the UTC day (checklist 13, 14)
- [ ] `queues listings with open reports, oldest first, grouped by listing`, with pagination and limit 100
- [ ] `resolves only the listed reports and leaves a newer report open`
- [ ] `refuses stale or foreign report ids and writes nothing`
- [ ] `hides an approved listing when resolving with LISTING_HIDDEN`; `closes reports without a write when the listing is already hidden`; `refuses LISTING_HIDDEN for an archived listing`
- [ ] `blocks the owner's account when resolving with ACCOUNT_BLOCKED, and the handler hides the listing`
- [ ] `refuses LISTING_HIDDEN without directory.listing.hide` and `refuses ACCOUNT_BLOCKED without contact.customerAccount.block`, nothing written (403)
- [ ] `hides the listing when its account is blocked from the contact screen`; `does nothing twice when the handler runs again`; `leaves a submitted listing unchanged`; `does not unhide on unblock`
- [ ] `rate-limits the listing detail per IP and per account` (the 61st call in a minute → 429)
- [ ] `never sends reports or reporter ids to the listing owner`: `GET /my/listing` has no report data
- [ ] permission denied: queue without `directory.report.read`, resolve without `directory.report.resolve`
- [ ] cross-org: org B cannot read or resolve org A's reports; a report id from org A in an org B resolve is stale
- [ ] module off: the generated module-off tests list the new routes
- [ ] template validation: duplicate `reportReasons` keys refused; a template without `reportReasons` still validates
- [ ] The §11 checklist table in the handoff: 2, 6, 7, 8, 11, 13–17, 19–24 apply.

---

## Part A2: blocks, self-erasure, data export (planned now, refreshed by the lead after A1 merges)

### Decisions
9. **ListingBlock** (directory, organization scope, audit fields; collection `listing_blocks`): `{ customerAccountId, listingId, createdAt }`, unique `{ organizationId, customerAccountId, listingId }`.
   - `POST /my/listing-blocks { listingNumber }` (idempotent: 200 with the existing row)
   - `DELETE /my/listing-blocks/:listingNumber` (204, also when there is no block)
   - `GET /my/listing-blocks?page&limit`
   - At most `DIRECTORY_SAFETY_RULES.blocksPerAccountMax` (500) per account → 409, so the search can use a bounded `$nin`.
   - Search for a signed-in caller excludes their blocked listing ids. The detail page still opens: the caller asked for it by number.
   - A customer cannot block their own listing.
10. **Self-erasure:** `POST /storefront/orgs/:organizationId/my/account/erase` with `{ challengeId, code }` from a fresh OTP sent to the account's own phone. A deletion asks for proof again; a stolen session cookie alone is not enough. In one `unitOfWork.run`:
    1. the owner's listing is archived through directory's port (the `archive()` path, so data is cleared)
    2. the blocks and open reports **filed by** the account are deleted
    3. the contact is anonymized through the existing anonymize logic, which already deletes the account and its sessions (`end-customer-login.ts`)

    Credit entries, unlocks and purchases stay as ids for the ledgers (doc 16 §2.3). The remaining balance is forfeited: the response and the M.6 confirmation page say so. A PENDING credit purchase is cancelled first, so staff do not verify money for an erased account. Audit `CUSTOMER_ACCOUNT_ERASED`, actor null. No personal data in the audit or the event.
11. **Data export:** `GET /storefront/orgs/:organizationId/my/data-export` returns JSON with no PRIVATE-tier filtering for the owner (it is their own data):
    - the account (phone, created, last login)
    - the contact fields
    - the listing with all tiers, and its consents with the version hashes
    - credit entries, unlocks, purchases, the blocks and reports filed by the account

    Each list is capped at 1000 rows, with `truncated: true` when cut. Rate limit: 3 per account per day. Every module answers through a port exported from its `index.ts`; contact owns the use case.

Part A2 files: listed when the lead refreshes the plan after A1 merges.

---

## Part B: admin report screens (after A1 merges)
12. Screens in `apps/admin/src/directory/` following the M.3 queue and detail pages:
    - **Reports queue** (`/{orgSlug}/directory/reports`): the grouped queue of decision 4. Card layout on mobile; each card shows the listing number, status, open count, reason labels (from `GET /directory/config` `reportReasons`) and the oldest report's age.
    - **Report detail:** the listing summary (the staff view M.3 already has), the open reports with reason, note and time, and a resolve sheet. The outcome radio list offers `LISTING_HIDDEN` and `ACCOUNT_BLOCKED` only when `/me/config` grants the second permission. It sends exactly the report ids on screen.
    - A 409 `directory.report.stale` reloads the list with a toast.
    - i18n keys BN/EN (add-only); `listing` term in the labels; script budget ≤ 180 KiB per route.
    - Tests: unit tests for the outcome options per permission and for the stale reload; one browser test that resolves a report with DISMISSED.

## Out of scope
- The storefront buttons and pages (M.6).
- The warning and result SMS (M.8).
- Automatic hiding after N reports: no rule from the owner yet.
- Reporting other accounts (only listings).
- IP-based bans.
- Legal review of the data handling (owner, before M.9).

## Risks & checks
- The queue aggregation must start with `$match` on `organizationId` and `status`. Check `explain()` once in the handoff.
- Make sure the handler sees the block event even when the block came from the report resolve. Both go through the same contact path; one test covers each.
- `git grep -n "industry\|MATRIMONY\|biodata" -- apps/api/src/modules/commerce/directory` finds nothing new.

## Done when
Each part: its tests pass, CI is green on the branch head, the handoff has the §11 table (A1, A2), and `npm run card:check` is all PASS.

---

## Refresh A2 (2026-10-24, lead, Based on commit: `main` after 3.27 and M.8a)

A1 is merged. Decisions 9–11 stand. This section adds what the code needs and lists the files. Where they differ, this section wins.

### A2 decisions added
13. **The erase code has its own purpose.** `OtpChallenge` gets `purpose: CUSTOMER_OTP_PURPOSE` (`SIGN_IN | ERASE_ACCOUNT`, new in `@banijjik/contracts/contact`). The schema default is `SIGN_IN`, so existing rows stay valid and need no migration. Sign-in verify refuses a challenge whose purpose is not `SIGN_IN`. Erase refuses any purpose other than `ERASE_ACCOUNT`. So a code sent for signing in can never delete an account.
    - `POST /storefront/orgs/:organizationId/my/account/erase/otp` (signed-in customer, no body): sends an `ERASE_ACCOUNT` challenge to the **account's own phone** and returns `{ challengeId, expiresAt }`. Same per-phone and per-IP send limits as sign-in (`CUSTOMER_OTP_RULES`). The SMS goes through the existing outbox handler (`send-customer-otp-sms.handler.ts`) with its own message key per purpose ("code to delete your account").
    - `POST .../my/account/erase` `{ challengeId, code }`: the challenge must belong to the account's phone, be unused, unexpired, have attempts left (`canTakeGuess`) and have purpose `ERASE_ACCOUNT`. A wrong code counts an attempt, like sign-in. It is consumed in the erase transaction.
14. **Contact owns erasure. Other modules take part through required ports.** Contact gets a new use case `EraseOwnCustomerAccountUseCase`. Its dependencies include `erasureParticipants: readonly CustomerErasureParticipant[]` (required, can be empty in a unit test):
    ```ts
    export interface CustomerErasureParticipant {
      /** Inside the erase transaction. Idempotent: a second call finds nothing to do. */
      eraseForAccount(input: { organizationId: OrganizationId; customerAccountId: CustomerAccountId; now: Date }): Promise<void>;
    }
    ```
    - **directory** exports `buildDirectoryErasureParticipant()`: archives the account's active listing through the same domain path as `ArchiveMyListingUseCase` (entity `archive()`, audit `LISTING_ARCHIVED`, event `LISTING_ARCHIVED`; no listing is fine), and deletes the blocks and OPEN reports **filed by** the account. Reports filed **against** the listing stay for staff.
    - **credit** exports `buildCreditErasureParticipant()`: cancels every PENDING purchase of the account the way `CancelCreditPurchaseUseCase` does (audit and event per purchase). Entries, unlocks and verified purchases stay (doc 16 §2.3).
    - Wired in `routes/storefront.ts` next to the existing builders. No module imports another module's infrastructure.
    - Then contact anonymizes the account's contact: `Contact.anonymize(now)` and `endCustomerLogin()` (deletes the account and its sessions), with actor null. The contact update uses its `version` read in the same transaction. Audit `CUSTOMER_ACCOUNT_ERASED` (new in contracts) with the account id only. Event `contact.customer_account.erased` (new in contracts) with ids only.
    - Response `200 { erased: true, forfeitedCredits: <balance before erase> }`, and the auth cookies are cleared, as on logout.
15. **Data export through a second port:**
    ```ts
    export interface CustomerDataExportParticipant {
      readonly sectionKey: CustomerDataExportSectionKey; // contracts enum: LISTING | DIRECTORY_ACTIVITY | CREDIT
      exportForAccount(input: { organizationId: OrganizationId; customerAccountId: CustomerAccountId; maxRows: number }): Promise<CustomerDataExportSection>;
    }
    ```
    The section response types live in `@banijjik/contracts/contact` (`customer-data-export.ts`). Every list has `truncated: boolean`, and `maxRows` is 1000 (constant in contracts). Directory gives the listing with all tiers and its consents with version hashes (`LISTING`), plus the blocks and reports filed (`DIRECTORY_ACTIVITY`). Credit gives entries, unlocks and purchases (`CREDIT`). Contact adds the account (phone, created, last login) and the contact's fields. No `_id`, no internal field, no secret, no OTP data.
    - Rate limit 3 per account per day: the kernel limiter with `keyOf` = `customerAccountId`, as the directory storefront router does.
16. **Blocks (decision 9) live in directory.** Collection `listing_blocks`, tenant plugin, audit fields, `version`, unique `{ organizationId, customerAccountId, listingId }`, list index `{ organizationId, customerAccountId, createdAt }`. The search's `$nin` reads at most `blocksPerAccountMax` ids with one indexed query. A blocked listing is still allowed in the unlock flow: blocking is the caller's own filter, not a ban.
17. **Order inside the erase transaction:** verify and consume the challenge, then the participants (directory, then credit), then the contact. Any failure rolls back everything, and the code stays consumed only if the transaction committed.

### Files (Part A2)
| Path | Create/Change | Owns / add-only | Purpose |
|---|---|---|---|
| `packages/contracts/src/contact/**` | Change | add-only | `CUSTOMER_OTP_PURPOSE`, erase audit action and event, export section types and keys, `CUSTOMER_DATA_EXPORT_MAX_ROWS` |
| `packages/contracts/src/directory/**` | Change | add-only | block rule keys and limits (if not in A1's `DIRECTORY_SAFETY_RULES`) |
| `packages/validation/src/contact/**`, `packages/validation/src/directory/**` | Change | add-only | erase body, block body and params |
| `apps/api/src/modules/commerce/contact/**` (OTP purpose, erase and export use cases, ports, storefront routes, README) | Change/Create | owns | decisions 10, 11, 13–15, 17 |
| `apps/api/src/modules/commerce/directory/**` (blocks: domain, schema, repository, routes; erasure and export participants; search exclusion; README) | Change/Create | owns | decisions 9, 14–16 |
| `apps/api/src/modules/commerce/credit/**` (erasure and export participants, README) | Change/Create | owns | decisions 14, 15 |
| `apps/api/src/routes/storefront.ts` | Change | add-only | wire the participants |
| `packages/i18n` catalogs | Change | add-only | SMS text per purpose, rule messages |
| `docs/16 §2.3` note, ADR-134 amendment (erase code purpose, participants), `docs/handoffs/M.7-api-erasure.md`, STATUS row M.7 | Change/Create | | |

### Tests (Part A2, must exist and pass)
- Blocks: block, block again (200, same row), unblock (204, also with no block), list paged; the 501st block → 409; a signed-in search hides blocked listings, the detail by number still opens; blocking one's own listing → 422; another organization's listing number → 404.
- Erase code: a sign-in code is refused for erase and an erase code is refused for sign-in; a wrong code counts an attempt; an expired or used challenge is refused; the send goes only to the account's own phone (body ignored or refused).
- Erase: after erase, the listing is ARCHIVED with its data cleared, the account and sessions are gone (the old cookie gets 401), the contact is anonymized, filed blocks and open reports are deleted, reports against the listing remain, a PENDING purchase is CANCELLED, credit entries remain; the response shows the forfeited balance; audit and event carry no phone or name. A failing participant (test double that throws) rolls back everything and the code stays usable.
- Export: every section present with `truncated` flags, the 1001st row cut, no `_id` or secret field, the fourth export in a day → 429; another account's data never appears.
- Module off: erasure and export run every participant whatever the module state. The data may exist from a time when the module was on, and erasure is the customer's right. Tests: with `directory` off, erase still archives the listing; with `credit` off, the export still lists the credit entries.
- Permission and tenancy: unauthenticated → 401; a token of another organization → 401/403 as the storefront does today; cross-org listing numbers → 404.
- T1 §11 table in the handoff, items 1, 2, 6, 7, 11, 15–24 each with a test or file.

---

## Refresh B (2026-10-24, lead)
Decision 12 stands. The routes exist: `GET /directory/reports`, `GET /directory/listings/:listingId/reports`, `POST /directory/listings/:listingId/reports/resolve`, and `reportReasons` in `GET /directory/config`. The menu entry exists (`groupKey: "directory"`, path `directory/reports`, `DIRECTORY_REPORT_READ`). No API change. Folders: `apps/admin/src/directory/**`, `packages/i18n` (add-only). Part B can run beside A2: A2 changes no tenant route and no admin file.
