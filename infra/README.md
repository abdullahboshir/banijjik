# infra

Local development services through Docker Compose (project name `banijjik`). Both ports are bound to `127.0.0.1` only.

| Service | Image | Host port | Notes |
|---|---|---|---|
| `mongo` | `mongo:8` | 27017 | Single-node replica set `rs0`, so transactions work. Initiated by the health check on first start. |
| `redis` | `redis:7` | 6379 | Append-only persistence. |

## Commands (from the repo root)

```bash
npm run infra:up      # start in the background
npm run infra:down    # stop, keep data
npm run infra:reset   # stop AND delete the data volumes (local dev data only, no confirmation)
```

First start takes about 10 to 20 seconds while the replica set initiates. `docker compose -f infra/docker-compose.yml ps` shows both services `healthy` when ready.

## Connection strings (local only)

```
DB_PLATFORM_URL=mongodb://127.0.0.1:27017/banijjik_platform?replicaSet=rs0&directConnection=true
DB_TENANT_SHARED_URL=mongodb://127.0.0.1:27017/banijjik_tenant_shared?replicaSet=rs0&directConnection=true
REDIS_URL=redis://127.0.0.1:6379
```

`directConnection=true` stops the driver from following the member's internal hostname. The two databases are logical databases on the same server (ADR-043).

## Troubleshooting

- Port 27017 or 6379 already in use: stop the other service. The defaults are not changed silently.
- Mongo stays `starting`: wait for the health check to initiate the set, then check `docker compose -f infra/docker-compose.yml logs mongo`.
- Check the replica set: `docker compose -f infra/docker-compose.yml exec mongo mongosh --quiet --eval "rs.status().ok"` prints `1`.
