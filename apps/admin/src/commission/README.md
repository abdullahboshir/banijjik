# Commission screens (3.11 Part B)

Server pages under `/{orgSlug}/commission/`: `entries` and `mine` (accrued commission), `payouts` and `payouts/{commissionPayoutId}` (what was paid, and paying a member's open total), and `rules` (who earns what; add, edit, archive). Each page checks its `commission.*` permission and the `COMMISSION` module, then reads the commission API.

- The rule sheet and the pay sheet load on first use. The pay sheet previews the total first and sends it as `expectedTotal`; a changed total (409) needs a second confirmation.
- Percent is typed as a percent and sent as integer basis points (`commission-percent.ts`). Fixed amounts go through the shared money input.
- Client components read their text from the nested provider in `commission-client-text.tsx` (mounted by the commission `layout.tsx`), so the screen catalogs stay out of every other page's first load.
