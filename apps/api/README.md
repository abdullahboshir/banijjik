# @banijjik/api

The banijjik backend package: validated config (0.3), the HTTP kernel (0.4a) and the database kernel (0.4b).

## Run

```bash
npm run infra:up                # local MongoDB replica set + Redis (see infra/README.md)
cp apps/api/.env.example apps/api/.env
npm run config:check            # exits 1 and lists bad KEYS (never values) when something is wrong
npm run dev -w @banijjik/api    # ROLE=api: HTTP server with reload; GET http://localhost:4000/health
npm run build -w @banijjik/api && npm start -w @banijjik/api   # compiled entry
npm test -w @banijjik/api       # starts an in-memory MongoDB replica set itself (see Tests)
```

Local services use host ports 27018 (Mongo, to avoid a native MongoDB on 27017) and 6379 (Redis); override with `BANIJJIK_MONGO_PORT` / `BANIJJIK_REDIS_PORT` (see `infra/README.md`).

## Layout

- `src/main.ts`: loads config, then starts the API (`ROLE=api`) or the worker (`ROLE=worker`, no HTTP, waits for shutdown). SIGTERM/SIGINT run the shutdown tasks in order, then end the process with exit 0 (exit 1 when a task failed, on timeout or on a second signal). A stray rejection or uncaught exception is reported through `reportError` and exits 1.
- `src/app.ts`: `buildApp({ config, logger })`. Middleware order: request id, access log, CORS, JSON body (1 MB), `/health`, `/api/v1`, not-found, error handler.
- `src/routes/v1.ts`: the only place that mounts module routers and global middleware.
- `src/kernel/http`: `AppError` and its factories, `sendData`, `validate({ params, query, body })` (parsed values in `response.locals.validated`), `errorHandler`. Errors use the envelope of `docs/14-API.md`; messages and stacks never reach a response.
- `src/kernel/context`: request context in AsyncLocalStorage. `src/kernel/logger`: pino with redaction, `getLogger()` is request-scoped. `src/kernel/observability`: `reportError`. `src/kernel/lifecycle`: `registerShutdown`.
- `src/kernel/db`: `connectDatabases(config)` opens ONE cluster client; the tenant database is `useDb` on it, so one session spans both (ADR-043). Business code gets models only through `models(ctx).get(name)`; modules `registerModel({ modelName, collectionName, database, schema })` at startup and never compile models. Also: schema parts, `stripMongoInternals`, `updateVersioned` (409 `details.currentVersion` / 404), `withTransaction` (nested reuse, up to 5 attempts on `TransientTransactionError` with a jittered backoff (50 ms doubling to 800 ms, plus 0 to 100% random), then `RETRY_LATER` (503), `onCommitted` callbacks only after the commit), `getActiveSession`, `GET /ready` (2 s ping: 200 or 503).
- `src/kernel/sequence`: `nextSequenceValue({ organizationId, sequenceKey })`, an atomic per-organization counter on the tenant `sequences` collection. Two modes per key (`SEQUENCE_KEY_MODE`, ADR-085): FAST keys run outside the transaction (no conflicts, gaps allowed); GAPLESS keys (INVOICE, JOURNAL, ZREPORT) join the transaction and throw without one.
- `src/kernel/context/run-as-system.ts`: `runAsSystem(reason, work)`, logged as `system_access`. The system mark lives in its own storage (`getSystemReason()`), not in `RequestContext`. Lint rules R26 (runAsSystem, also in `infrastructure`) and R27 (`runWithRequestContext`) keep both out of module code (platform use cases excepted for R26).

## Build

`npm run build` compiles `tsconfig.build.json`, which leaves out `*.test.ts` and `src/test-support`, so `dist` holds production code only. `typecheck` uses the full `tsconfig.json`.

## Tests

`npm test` runs a vitest global setup (`src/test-support/replica-set.global-setup.ts`) that starts a one-member `mongodb-memory-server` replica set (MongoDB 8.0.13, wiredTiger; set `MONGOMS_SYSTEM_BINARY` to a local `mongod` to skip the download) and shares its URI with the tests through `inject("mongoUri")`. Every test file creates its own databases. The first run downloads the server binary (about 750 MB download, 76 MB kept) into `node_modules/.cache/mongodb-memory-server` of the repository, so it needs network access and free space on the repository drive. CI should cache that folder.

Startup (`main.ts`) connects before it listens or starts the worker and exits 1 with `db.connect_failed` when it cannot. In production indexes are not built at startup (`autoIndex` is off); an explicit index-sync task is a later card.

## Rules

- `process.env` is read only inside `src/config/` (`load-config-from-process.ts` is the only reader). Everything else receives an `AppConfig`.
- `loadConfig(env)` reports every bad key at once. Error messages hold keys and fixed hints, never values.
- A missing `.env` file is fine: CI and production set real environment variables.

## Config keys

| Key                                               | Rule                                                                    | Default       |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ------------- |
| `NODE_ENV`                                        | `development`, `test` or `production`                                   | `development` |
| `PORT`                                            | integer 1 to 65535                                                      | `4000`        |
| `LOG_LEVEL`                                       | `fatal`, `error`, `warn`, `info`, `debug`, `trace`                      | `info`        |
| `ROLE`                                            | `api` (HTTP server) or `worker` (no HTTP, waits for shutdown)           | `api`         |
| `DB_PLATFORM_URL`                                 | `mongodb://` or `mongodb+srv://` URL with a database name               | required      |
| `DB_TENANT_SHARED_URL`                            | same                                                                    | required      |
| `REDIS_URL`                                       | `redis://` or `rediss://` URL                                           | required      |
| `CORS_ALLOWED_ORIGINS`                            | comma-separated absolute `http(s)` origins; `*` is always rejected      | required      |
| `AUTH_ACCESS_TOKEN_SECRET`                        | random string, at least 32 characters; signs access tokens              | required      |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS`                   | access token lifetime                                                   | `900`         |
| `AUTH_REFRESH_TOKEN_TTL_DAYS`                     | sliding refresh session lifetime                                        | `30`          |
| `AUTH_SESSION_FAMILY_MAX_DAYS`                    | hard limit of one login family                                          | `90`          |
| `COOKIE_DOMAIN`                                   | optional cookie domain, e.g. `.example.com`                             | unset         |
| `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` | both or neither; used by `npm run seed:platform-admin -w @banijjik/api` | unset         |

In `production`, database and Redis URLs must not point to `localhost` or `127.0.0.1`.

`DB_TENANT_SHARED_URL` must name the same hosts, the same credentials and the same query options as `DB_PLATFORM_URL`, and a different database. One cluster client serves both databases (one transaction spans them), so only the platform URL opens a connection; a tenant URL with another login would otherwise be ignored without a word. Dedicated tenants (Phase 8) lift this.
Later cards add their own keys here and in `.env.example`.
