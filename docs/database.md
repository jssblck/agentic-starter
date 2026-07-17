# Database and migrations

## Drizzle boundary

`libs/db/src/schema.ts` defines the typed Postgres schema. `repository.ts` maps database rows into stable domain values and is the only application-facing persistence API.

Applications must not import Drizzle query builders or table objects directly. This keeps transaction, tenancy, migration, and mapping policy in one package.

## Migration workflow

```sh
# edit libs/db/src/schema.ts
bun run db:generate
# inspect the generated SQL
bun run db:migrations:check
bun run db:migrate
```

SQL migrations are immutable after they may have run anywhere. The static check rejects edits to committed migration files against the pull request base, and the migration runner rejects a changed checksum for any applied file.

The example runner uses a Postgres advisory lock, a migration ledger, one transaction per migration, and SHA-256 checksums. It reads Drizzle Kit's numbered SQL files rather than relying on development-time schema push.

## Safe production rollout

Do not assume a new application and migration become visible atomically. Prefer expand-and-contract changes:

1. add nullable columns or compatible structures;
2. deploy code that can read old and new shapes;
3. backfill in bounded batches;
4. enforce new constraints;
5. remove old reads and writes;
6. drop obsolete structures in a later release.

The container runs migrations only when `RUN_MIGRATIONS=1`. In larger systems, run the same command in a single release job or dedicated migration task before replacing application replicas.
