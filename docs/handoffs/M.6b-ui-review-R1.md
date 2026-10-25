# Review R1: card M.6b (storefront app, public pages) · T2, proxy and host files as T1 · 2026-10-25 · lead (Opus 5.5)

Branch `s/M.6b-ui-storefront` at `1893cc2b` (CI 40161995886 green on every job), rebased on `main` (docs only since its base; the M.6 plan conflict kept Amendment 1 before Refresh M.6c).

## Result: accepted, merged after one lead fix

Checked:
- **Host → organization (decision 9):** `proxy.ts` replaces the organization header on every request (a client copy is deleted first); unknown hosts and failed lookups are not trusted; positive and negative answers cached 60 s, failures not cached.
- **Same-origin proxy (decision 10, Amendment 1):** only `accept`, `accept-language`, `content-type`, `cookie`, `idempotency-key`, `x-forwarded-for` and `user-agent` go upstream (no `Origin`, no `Host`); every `Set-Cookie` comes back; redirects are not followed; a 10 s timeout gives a 502 in the API error shape. A foreign-origin write is refused before the path check; `Origin: null` is refused. `x-forwarded-for` is passed as received, documented in `docs/ops/storefront-deployment.md`.
- **Budget:** the `nomodule` skip in the budget test is the same rule as `apps/admin/src/test-support/initial-js-size.ts`. Measured 149.0 / 149.0 / 149.0 / 150.6 KiB (budget 170).

## Lead fix on the branch
1. **Encoded slash in the proxied path (T1).** Next.js gives the catch-all segments decoded, so `/api/v1/storefront/orgs/<own>/..%2F..%2Forgs%2F<other>/listings` arrived as one segment `../../orgs/<other>`: it is not a bare `..`, so the guard allowed it, and the upstream URL joined it raw; `fetch` then normalised the dots and the request reached another organization's path. Fixed in two places: `path-guard.ts` refuses any segment that contains `/` or `\`, and `proxy-request.ts` encodes each segment again when it builds the upstream URL. Test: `refuses a segment that hides a slash, so an encoded path cannot reach another organization`.

## Follow-ups (in LEAD-STATE)
- The directory submit answers 500 instead of 422 for a missing required field: fixed in M.6c (Refresh M.6c C2).
- Every listing page is `noindex` until the owner decides a template switch (owner decision, unchanged).
