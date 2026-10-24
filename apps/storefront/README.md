# Storefront (`@banijjik/storefront`)

The public website of a business: `<slug>.<STOREFRONT_BASE_DOMAIN>` (M.6b, decisions 8 to 14).

- `proxy.ts` resolves the Host to a business (through the API, cached for 60 seconds) and sets the
  `x-storefront-organization-id` header. Pages and route handlers never read the organization from the URL.
- `app/api/v1/storefront/[...path]` and `app/api/v1/public/files/[...path]` are the same-origin proxy to the API
  (ADR-119): no browser `Origin` is forwarded, a foreign-origin write is refused (403), a path naming another
  business is refused (404), every `Set-Cookie` is passed back.
- Static pages are Markdown, rendered with markdown-it without raw HTML (`src/markdown`).
- Text: `STOREFRONT_CATALOGS` in `@banijjik/i18n` (`storefront.*` keys, Bangla and English).

Environment: `STOREFRONT_API_ORIGIN` (the API, server to server, e.g. `http://localhost:4000`).
The browser test (`npm run test:browser`) needs a built API, MongoDB, Redis on 6380 and Chrome (`CHROME_PATH`).
