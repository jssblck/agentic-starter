# PostgreSQL

Drizzle keeps schema and queries typed while staying close to SQL. Migrations are reviewed artifacts. Every worktree gets its own database through eph.

## Packages

- `libs/db`: `schema.ts` (Drizzle tables), `client.ts` (`createDatabase(url)` returning `{ db, client, close }`), `repository.ts` (the only application-facing persistence API, mapping rows to domain values), `memory.ts` (an in-memory repository for tests), `migrations.ts` (`runMigrations(url)`), `migrate.ts` (entrypoint that reads `DATABASE_URL`).
- `libs/db/drizzle.config.ts` and `libs/db/drizzle/*.sql` (generated migrations).
- `tools/check-migrations.ts`: fails when a committed migration file was modified relative to the PR base.
- `tests/integration/database.test.ts`: runs against real Postgres; skips when `DATABASE_URL` is unset.

## Dependencies

| Package       | Version | Where                |
| ------------- | ------- | -------------------- |
| `drizzle-orm` | 0.45.2  | `libs/db`            |
| `postgres`    | 3.4.9   | `libs/db`            |
| `drizzle-kit` | 0.31.10 | root devDependencies |

Postgres image: `postgres:18.4-alpine`.

## Shape

- Applications depend on the repository interface, never on Drizzle tables or query builders. Raw SQL and Drizzle stay inside `libs/db`.
- The migration runner: take `pg_advisory_lock(hashtext('<project>:migrations'))`, create a ledger table (`name`, `checksum`, `applied_at`), read the numbered `.sql` files in order, run each unapplied file in one transaction and record its SHA-256, and fail if an applied file's checksum changed. Do not use development-time schema push.
- SQL migrations are immutable once they may have run anywhere. Add a new one instead of editing.
- Prefer expand-and-contract for production changes: add compatible structures, deploy code that reads both shapes, backfill in bounded batches, enforce constraints, remove old paths, drop later.

## Workflow

```sh
# edit libs/db/src/schema.ts
bun run db:generate       # drizzle-kit generate
# inspect the SQL
bun run db:migrations:check
bun run db:migrate
```

## Tests

- Repository behavior against real Postgres in `tests/integration`. Mocks cannot prove migration behavior or constraints.
- Everything else uses `createMemory<Thing>Repository()`.

## Hubs

- `package.json`: `db:generate` (`drizzle-kit generate --config libs/db/drizzle.config.ts`), `db:migrate` (`bun libs/db/src/migrate.ts`), `db:migrations:check` (`bun tools/check-migrations.ts`), `test:integration` (`bun test tests/integration`). Add `db:migrations:check` to `ci`, not `check`.
- `.eph`:

  ```ini
  roles_order=dep,app

  [postgres]
  image=postgres:18.4-alpine
  role=dep
  port=5432
  env.POSTGRES_USER=<name>
  env.POSTGRES_PASSWORD=<name>
  env.POSTGRES_DB=<name>
  volume=pgdata:/var/lib/postgresql
  healthcheck=pg_isready -U <name> -d <name>

  [env]
  DATABASE_URL=postgres://<name>:<name>@localhost:${postgres.port}/<name>
  ```

  Add `pre-start=bun run db:migrate` to the server block. The Claude `SessionStart` hook and Codex setup already run `eph up --role dep`, so Postgres prewarms in every worktree.

- `.github/workflows/ci.yml`: an `integration` job with a `postgres` service, `bun run db:migrate`, `bun run test:integration`, and a PR-only step `bun run db:migrations:check -- --base "${{ github.event.pull_request.base.sha }}"`.
- `.env.example`: `DATABASE_URL`.
- `.nudge.yaml`: a `UserPromptSubmit` reminder on `(?i)(database|schema|migration|column|postgres|drizzle)` that says schema changes need generated SQL, matching API schemas, and migration tests. Add positive and negative fixtures and register them in `tools/check-nudge-rules.ts`.
- `AGENTS.md` check classification: "Database schema: edit `libs/db/src/schema.ts`, run `bun run db:generate`, inspect the SQL, and add migration tests. Never edit a migration that may already have shipped."
- `AGENTS.md` invariants: "Keep raw SQL and Drizzle access inside `libs/db`."
- `docs/architecture.md`: add the dependency edge and the invariant.
- Docker (release capability): the entrypoint runs `bun libs/db/src/migrate.ts` only when `RUN_MIGRATIONS=1`.
