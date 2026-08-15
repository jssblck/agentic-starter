# PostgreSQL

Postgres is the default store, and it stays the default until it cannot hold the scale, which almost never happens. Drizzle keeps schema and queries typed while staying close to SQL. Migrations are reviewed artifacts. Every worktree gets its own database through eph.

## Rules that follow from "Postgres first"

- No Redis by reflex. Caching, rate limiting, locks, and short-lived state go in Postgres (`UNLOGGED` tables, advisory locks, `pg_boss` tables) until a measured problem says otherwise.
- The job queue runs on Postgres. See [Worker](worker.md).
- Realtime fan-out uses `LISTEN`/`NOTIFY` behind an SSE route handler; the queue already holds a listening connection.
- One database per environment; schemas separate concerns inside it. App tables live in the `public` schema or a named `pgSchema`; pg-boss owns `pgboss`.

## Packages

- `libs/db`: `schema.ts` (Drizzle tables), `client.ts` (`createDatabase(url)` returning `{ db, close }`, driver chosen per process below), `repository.ts` (the only application-facing persistence API, mapping rows to domain values), `memory.ts` (an in-memory repository for tests), `migrations.ts` (`runMigrations(url)`), `migrate.ts` (entrypoint that reads `DATABASE_URL`).
- `libs/db/drizzle.config.ts` and `libs/db/drizzle/*.sql` (generated migrations).
- `tools/check-migrations.ts`: fails when a committed migration file was modified relative to the PR base.
- `tests/integration/database.test.ts`: runs against real Postgres; skips when `DATABASE_URL` is unset.

## Dependencies

| Package           | Version | Where                |
| ----------------- | ------- | -------------------- |
| `drizzle-orm`     | 0.45.2  | `libs/db`            |
| `drizzle-kit`     | 0.31.10 | root devDependencies |
| `pg`, `@types/pg` | 8.23.0  | `libs/db`            |

Postgres image: `postgres:18-alpine` (18 is GA; 14 reaches end of life in November 2026).

Drizzle 1.0 is in release candidates as of August 2026 and 0.45 has been static since March. Plan the upgrade; do not start on the RC.

### Driver

Every server process (the Next app, the Hono server, the worker) runs on Node, so there is one driver: `drizzle-orm/node-postgres` over `pg`. Set `prepare: false` only if a transaction-mode pooler sits in front.

Do not use `postgres` (postgres.js); its maintenance slowed sharply in 2026. Integration tests (`tests/integration`) go through the same `pg` pool under Vitest.

## Shape

- Applications depend on the repository interface, never on Drizzle tables or query builders. Raw SQL and Drizzle stay inside `libs/db`.
- The migration runner: take `pg_advisory_lock(hashtext('<project>:migrations'))`, create a ledger table (`name`, `checksum`, `applied_at`), read the numbered `.sql` files in order, run each unapplied file in one transaction and record its SHA-256, and fail if an applied file's checksum changed. Do not use `drizzle-kit push` against anything but a throwaway database, and if you ever run `push` or `pull`, set `schemaFilter` so it ignores `pgboss`.
- SQL migrations are immutable once they may have run anywhere. Add a new one instead of editing.
- Prefer expand-and-contract for production changes: add compatible structures, deploy code that reads both shapes, backfill in bounded batches, enforce constraints, remove old paths, drop later.
- Multi-tenant data carries the tenant (organization) id on every row and every query. Do not rely on application code to remember the filter; put it in the repository signature.

## Workflow

```sh
# edit libs/db/src/schema.ts
pnpm run db:generate      # drizzle-kit generate
# inspect the SQL
pnpm run db:migrations:check
pnpm run db:migrate
```

## Tests

- Repository behavior against real Postgres in `tests/integration`. Mocks cannot prove migration behavior or constraints.
- Everything else uses `createMemory<Thing>Repository()`.

## Hubs

- `package.json`: `db:generate` (`drizzle-kit generate --config libs/db/drizzle.config.ts`), `db:migrate` (`node libs/db/src/migrate.ts`), `db:migrations:check` (`node tools/check-migrations.ts`), `test:integration` (`vitest run --project integration`). In `vitest.config.ts`, split `test.projects` into `unit` (the existing include) and `integration` (`tests/integration/**/*.test.ts`), and change `test` to `vitest run --project unit` so `check` never needs a database. Add `db:migrations:check` and `test:integration` to `ci`, not `check`.
- `.eph`:

  ```ini
  roles_order=dep,app

  [postgres]
  image=postgres:18-alpine
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

  Add `pre-start=pnpm run db:migrate` to the app blocks. The Claude `SessionStart` hook and Codex setup run `eph up`, so Postgres starts in every worktree.

- `.github/workflows/ci.yml`: a `postgres:18-alpine` service on the `ci` job with `DATABASE_URL`, `pnpm run db:migrate` before `pnpm run ci`, and a PR-only step `pnpm run db:migrations:check -- --base "${{ github.event.pull_request.base.sha }}"`.
- `.env.example`: `DATABASE_URL`.
- `.nudge.yaml`: a `UserPromptSubmit` reminder on `(?i)(database|schema|migration|column|postgres|drizzle)` that says schema changes need generated SQL, matching input schemas, and migration tests. Add positive and negative fixtures and register them in `tools/check-nudge-rules.ts`.
- `AGENTS.md` check classification: "Database schema: edit `libs/db/src/schema.ts`, run `pnpm run db:generate`, inspect the SQL, and add migration tests. Never edit a migration that may already have shipped."
- `AGENTS.md` invariants: "Keep raw SQL and Drizzle access inside `libs/db`. Reach for Postgres before any second datastore."
- Docker (release capability): the entrypoint runs `node libs/db/src/migrate.ts` only when `RUN_MIGRATIONS=1`; run migrations as a separate release step, not from every replica.
