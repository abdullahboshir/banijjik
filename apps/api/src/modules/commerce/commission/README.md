# commission (OPTIONAL)

Staff commission (card 3.11, ADR-135). Part A1: rules and the accrual ledger. No screens or payouts yet.

- Rules per member or role, for an offering, category, kind or everything; a percentage (basis points) or a fixed amount. One ACTIVE rule per slot; archived, never deleted.
- Member rules beat role rules; inside a level the most specific target wins; ties go to the higher amount, then the older rule.
- Base = booking price after discount, without tax. The amount is floored and clamped to the base.
- `commission.accrue` (UNORDERED, plan Amendment 1) accrues on `booking.booking.completed`. A refund or reversal of the payment reconciles the net to `accrual - floor(accrual * refunded / gross)`.
- `CommissionEntry` is append-only: a mistake is a later REFUND_ADJUSTMENT. Only `payoutId` is set once, by a payout (Part A2).
- Emits `commission.entry.recorded` on `commission:<memberId>`; accounting posts it in Part A2.
- API: rules under `/commission/rules`; reads at `/commission/entries`, `/my-entries` and `/summary`.
