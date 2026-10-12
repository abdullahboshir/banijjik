# Deploy: indexes

Production never builds indexes by itself (`autoIndex` is off). Correctness depends on them: unique email, slug, session and invitation token hashes, the idempotency claim, one default location, and every TTL cleanup. See ADR-094.

## First deploy and every deploy
1. Deploy the new code, but do not route traffic yet.
2. Run the task once per environment, with the production environment variables:
   `npm run db:sync-indexes -w @banijjik/api`
3. Read the output. One `indexes.collection_synced` line per collection shows `created`, `alreadyThere` and `conflicting`.
4. Start the API and the worker.

The task is safe to repeat and never drops an index.

## Exit code 1: a conflict
An `indexes.conflict` line means a collection already has an index on the same keys with other options (for example the old full unique index on `locations` name, now unique among ACTIVE locations only). The line contains the exact command, for example:
`db.getSiblingDB("<database>").getCollection("locations").dropIndex("organizationId_1_name_1")`
Check that the old index is wrong, run the command by hand, then run the task again.

## Startup guard
With `NODE_ENV=production` the API and the worker check the unique and TTL indexes after connecting. If any is missing or built with other options, the process logs `db.indexes_missing` with the collection names and exits 1. Run the task and start again.
