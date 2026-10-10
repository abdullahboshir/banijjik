# @banijjik/api

The banijjik backend package. Card 0.3 adds only the validated environment loader; the HTTP kernel arrives in card 0.4.

## Run

```bash
npm run infra:up                # local MongoDB replica set + Redis (see infra/README.md)
cp apps/api/.env.example apps/api/.env
npm run config:check            # exits 1 and lists bad KEYS (never values) when something is wrong
npm test -w @banijjik/api
```

Local services use host ports 27018 (Mongo, to avoid a native MongoDB on 27017) and 6379 (Redis); override with `BANIJJIK_MONGO_PORT` / `BANIJJIK_REDIS_PORT` (see `infra/README.md`).

## Rules

- `process.env` is read only inside `src/config/` (and the `check-config.ts` entry). Everything else receives an `AppConfig`.
- `loadConfig(env)` reports every bad key at once. Error messages hold keys and fixed hints, never values.
- A missing `.env` file is fine: CI and production set real environment variables.

## Config keys

| Key                    | Rule                                                                      | Default       |
| ---------------------- | ------------------------------------------------------------------------- | ------------- |
| `NODE_ENV`             | `development`, `test` or `production`                                     | `development` |
| `PORT`                 | integer 1 to 65535                                                        | `4000`        |
| `LOG_LEVEL`            | `fatal`, `error`, `warn`, `info`, `debug`, `trace`                        | `info`        |
| `DB_PLATFORM_URL`      | `mongodb://` or `mongodb+srv://` URL with a database name                 | required      |
| `DB_TENANT_SHARED_URL` | same                                                                      | required      |
| `REDIS_URL`            | `redis://` or `rediss://` URL                                             | required      |
| `CORS_ALLOWED_ORIGINS` | comma-separated absolute `http(s)` origins; `*` is rejected in production | required      |

In `production`, database and Redis URLs must not point to `localhost` or `127.0.0.1`.
Later cards add their own keys here and in `.env.example`.
