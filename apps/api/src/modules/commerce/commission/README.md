# commission (OPTIONAL)

Staff commission (card 3.11, ADR-135). Part A1: rules and the accrual ledger. Part A2: payouts and posting. No screens yet (Part B).

- Rules per member or role, for an offering, category, kind or everything; a percentage (basis points) or a fixed amount. One ACTIVE rule per slot; archived, never deleted.
- Member rules beat role rules; inside a level the most specific target wins; ties go to the higher amount, then the older rule.
- Base = booking price after discount, without tax. The amount is floored and clamped to the base.
- `commission.accrue` (UNORDERED, plan Amendment 1) accrues on `booking.booking.completed`. A refund or reversal of the payment reconciles the net to `accrual - floor(accrual * refunded / gross)`.
- Every accrual and every reconcile first touches one `commission_source_marks` document of the source (Amendment 2), so a completion and a refund that overlap conflict and the loser retries on the committed state.
- `CommissionEntry` is append-only: a mistake is a later REFUND_ADJUSTMENT. Only `payoutId` is set once, by a payout.
- A payout claims a member's open entries at one location with one conditional update on `payoutId: null`, checks the total against the preview (`expectedTotal`) and commits the claim, the payout, the audit entry and `commission.payout.paid` together. A negative total or a moved total aborts and leaves every entry open. Negative entries net into the next payout. There is no payout void: a wrong payout is corrected with a manual journal entry.
- Emits `commission.entry.recorded` and `commission.payout.paid`, both on the stream `commission:<memberId>` and nothing else on it. `accounting.postCommission` (ORDERED, `streamPrefixes: ["commission:"]`) posts them.
- API: rules under `/commission/rules`; reads at `/commission/entries`, `/my-entries` and `/summary`; payouts at `/commission/payouts` (`/preview`, create with `Idempotency-Key`, list, get).
