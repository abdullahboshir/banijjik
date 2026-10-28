# Phase 4 planning handoff

Date: 2026-10-27 · Planner: Codex · Branch: `s/docs-plan-phase-4` · Worktree: `E:/WEB-DEVELOPMENT/PROJECTS/business-platform/banijjik-m8a`
Based on: `016bd228ec92a40d65179dc8db1132184adab983`

## Delivered

Plans `4.1.md`, `4.2.md`, `4.3.md`, `4.3-COD.md`, `4.4.md`, `4.5.md`, `4.6.md`, and `phase-4-lanes.md`. Each active card has parts/dependencies, scope decisions, contracts/data, file ownership, named acceptance tests, risks and completion gates. Roadmap and only the new Phase 4 STATUS rows record the work. ADR-P4-A/B/C/D added as proposed architecture records; numeric IDs intentionally await integration because other planning branches are active.

## Owner answers

- Guest checkout is required alongside phone OTP accounts.
- 4.6 is folded into 4.3, confirmed rather than merely proposed.
- Provider choice delegated to planner: Cloudflare for SaaS selected; current official requirements and links are in 4.2.
- Full COD lifecycle moves into Phase 4. Manual courier/rider operations, settlement and accounting are explicit prerequisites; Phase 5 retains provider automation/rider mobile workflows.

## Findings addressed

- Existing storefront/website/customer-account code is reused; no duplicate app or identity.
- Contact has a unique active organization/phone index. Guest phone is a private checkout snapshot; provisional Contact does not claim canonical phone/email.
- Staff order commands hardcode ADMIN/product-only behavior; named adapter parts preserve existing rules while adding trusted STOREFRONT context.
- Enrollment may activate immediately on staff create; customer adapter explicitly requests PENDING.
- Booking request checks deposit; the plan preserves it and returns HELD/payment-required rather than pretending confirmation.
- Full COD needs missing shipping/RTS/settlement ownership and posting work; no website-only workaround.
- Personalized layout cannot be CDN-cached; private HTML remains no-store while public immutable projections may cache.
- Draft/legacy static page save, lock-policy restore and template-copy semantics are explicitly resolved.
- Same-industry warning candidates remain in platform/industry, avoiding feature-level industry reads.
- Dynamic section declarations arrive with real readers in 4.3; no circular dependency or fake section data in 4.1.

## Verification

Documentation-only change. Automated check output: 6 active plan documents, 11 required sections each, 6 TypeScript snippets syntax-parsed, 12 relative Markdown links checked, 6 Phase 4 STATUS rows and 4 unique proposed ADRs; errors: []. Snippet parsing is not application typechecking or proof that future types already exist. The first diff whitespace check found extra final blank lines in seven new plans; these were removed before the final check. Existing composition/editor/contact-index anchors were checked against the pinned checkout. No application typecheck/lint/test/build or browser suite was run or claimed: no application code changed, and guide §7/§8 plus card 3.44 use docs-only handling. The pre-commit and commit-message hooks run normally.

## Readiness and next action

These are **planned, not approved implementation plans**. A different tool must check T1 plans. Refresh each part against its merged dependencies, expand future-module file families into exact <=15-production-file T1 parts before coding, and resolve any reviewer findings. This is the documented whole-phase-planning exception requested by the owner; it does not waive rolling-wave refresh, independent review or Phase 3 closure.

Start with 4.1 A1 after the lead reconciles Phase 3 closure and the plan check. Do not change LEAD-STATE ownership or push main from this planning session. Cloudflare credentials/DNS target and a real staging smoke test are future deployment prerequisites, not completed work.

## Deviations and carried observations

All cards planned together by explicit owner request. 4.3 is materially larger because the owner pulled full COD forward; it is split into independently reviewed module-sized parts. No application code or unrelated Phase 3 card was changed. Current LEAD-STATE/STATUS differ on which Phase 3 fixes block Phase 4; the lead must reconcile this using actual merged review evidence. The main worktree's `.claude` local changes were untouched.

## Follow-up author audit (2026-10-28)

The later [audit R1](phase-4-plan-audit-R1.md) supersedes this handoff's initial contract assessment where corrected. It adds the shared assurance guide, fixes replay/booking/access/domain/migration/settlement/scalability seams, and records the owner's loss-reconciliation answer. The original verification above is historical evidence only; R1 records its own checks. No implementation or independent T1 approval is implied.
