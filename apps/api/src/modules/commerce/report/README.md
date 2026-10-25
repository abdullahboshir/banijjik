# Report (commerce/report, card 3.10)

CORE module, not disableable. It keeps one pre-aggregated row per location and organization-local
day (`DailySummary`) and serves the home and the reports from those rows. No request scans a source.

- **Counting:** the worker's `report.summarize` handler (UNORDERED) takes each sale, return, booking,
  enrollment, check-in, payment and expense event. The marker `ReportEventApplied` is written first
  in the same transaction as the `$inc`, so a redelivery counts nothing (ADR-147).
- **Dates:** every event counts on the organization-local date of its own instant or of the fact
  (`domain/business-date.ts`). A fact in another currency is refused.
- **Sources:** `routes/report-sources.ts` answers through each module's index with only the counted
  fields. The payloads carry ids only.
- **Reads:** `GET /reports/home` (today, yesterday, month to date) and `GET /reports/daily`
  (at most 92 days, 100 per page). Read-time values (net sales after returns, average order value,
  money in net) are computed in `domain/summary-counters.ts` and never stored.
- **Sections:** the home lists only the sections whose source modules are effective (ADR-033).

Not done yet: the rebuild command (plan decision 6) and the grants for owner and manager (see the
handoff `docs/handoffs/3.10-api.md`).
