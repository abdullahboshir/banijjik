# expense (CORE)

Operating expenses (rent, salary, utilities) with categories that each own an EXPENSE account.

- Create posts immediately and emits `expense.expense.posted` on `expenseAccount:<organizationId>`.
- Void keeps the row, emits `expense.expense.voided`, and accounting posts the reversing entry.
- Categories are seeded per organization; archive, never delete.
- Attachment required above `expense.requireAttachmentAbove` (purpose `ATTACHMENT`, ≤ 5).
