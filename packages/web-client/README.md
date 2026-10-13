# @banijjik/web-client

The generic browser and server code that every web app of the platform shares for talking to the API (card 1.8b).
It holds no screen and no text.

- `createApiClient(config)` gives an app its `apiFetch` (the `{ data, meta }` envelope, `ApiError`, one shared
  session renewal and one retry on a 401) and its `refreshSession`. The config names the API origin, the
  refresh path, the prefix of the auth paths that are never renewed, and what to do when the session is lost.
- `ApiError`, `parseApiResponse`, `networkError`, `PageMeta`.
- `safeNextPath`, the sign-in and session path builders, `sessionGuardTarget` and the renewed-marker cookie
  (its name is a parameter: cookies are shared by every port of a host, so each app uses its own marker).
- `@banijjik/web-client/server`: `createServerApiFetch({ baseUrl, apiPrefix, accessCookieName })` for server
  components. It forwards only the named access cookie, never the refresh cookie. It imports `next/headers` and
  `server-only`, so it cannot reach a browser bundle.

`apps/admin` and `apps/platform` each configure these once (cookie names, refresh path) and re-export the result.
Security fixes to the renewal flow are made here, once.

The same package also holds the pieces both apps used to copy (card 1.9e):

- `parseEnvironment` for the two `NEXT_PUBLIC_*` values. Each app still reads `process.env` by full name
  (Next.js only inlines them that way) and passes the values in.
- `@banijjik/web-client/server`: `getLocale` and `LOCALE_COOKIE_NAME`, beside `createServerApiFetch`.
- `@banijjik/web-client/client`: `I18nProvider`, `LanguageSwitch`, `LazyToaster`, `ShellLink`,
  `SessionRenewal`, `useLazyComponent`, `useLocaleChange`. `SessionRenewal` takes the app's own refresh
  function and loop-guard cookie, because those differ.
- `@banijjik/web-client/proxy`: `createRequestPathProxy(renewedCookieName)` for each app's `proxy.ts`.
