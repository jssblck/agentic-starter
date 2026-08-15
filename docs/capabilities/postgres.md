# PostgreSQL

Postgres is the default store, and it stays the default until it cannot hold the scale, which almost never happens. Drizzle keeps schema and queries typed while staying close to SQL. Migrations are reviewed artifacts. Every worktree gets its own database through eph.

## Rules that follow from "Postgres first"

- No Redis by reflex. Caching, rate limiting, locks, and short-lived state go in Postgres (`UNLOGGED` tables, advisory locks, `pg_boss` tables) until a measured problem says otherwise.
- The job queue runs on Postgres. See [Worker](worker.md).
- Realtime fan-out uses `LISTEN`/`NOTIFY` behind an SSE route handler; the queue already holds a listening connection.
- One database per environment; schemas separate concerns inside it. App tables live in the `public` schema or a named `pgSchema`; pg-boss owns `pgboss`.

## Packages

- `libs/db`: `schema.ts` (Drizzle tables), `client.ts` (`createDatabase(url)` returning `{ db, close }`; `import { Pool } from 'pg'`, the named export, or `import/no-named-as-default-member` fires), `repository.ts` (the only application-facing persistence API, mapping rows to domain values; accepts optional hooks such as `onCreated(tx, row)` so an app can enqueue inside the same transaction), `memory.ts` (an in-memory repository for tests), `migrations.ts` (`runMigrations(url, directory, lockName)` and `migrationsDirectory()`), `repository.integration.test.ts`.

  There is no `migrate.ts` in `libs/db`. The migration entrypoint belongs to an app (`apps/worker/src/migrate.ts`), for two reasons: `env-no-direct-process-env` forbids reading `DATABASE_URL` anywhere under `libs/`, and a filtered production install (`pnpm install --prod --filter @scope/worker...`) links workspace packages only for that app, so a script in `tools/` that imports `@scope/db` fails with `ERR_MODULE_NOT_FOUND` inside the image.

  Export the migrations directory as a **function**, not a module-scope constant. A constant computed from `import.meta.dirname` is evaluated when a Next server bundle imports the package, where `import.meta.dirname` is undefined, and `next build` fails with `The "paths[0]" argument must be of type string` while collecting page data.

- `libs/db/drizzle.config.ts` and `libs/db/drizzle/*.sql` (generated migrations).
- `tools/check-migrations.ts`: fails when a committed migration file was modified relative to the PR base.
- Integration tests live next to the code as `libs/**/*.integration.test.ts` and skip when the database URL is empty. A root `tests/integration` directory cannot import workspace packages under the isolated linker without adding them to the root `package.json`. They must not read `process.env` (it is under `libs/`): put `provide: { databaseUrl: process.env['DATABASE_URL'] ?? '' }` on the `integration` project in `vitest.config.ts` and read it with `inject('databaseUrl')`.

## Dependencies

| Package       | Version | Where          |
| ------------- | ------- | -------------- |
| `drizzle-orm` | 0.45.2  | `libs/db`      |
| `drizzle-kit` | 0.31.10 | `libs/db`, dev |
| `pg`          | 8.23.0  | `libs/db`      |
| `@types/pg`   | 8.21.0  | `libs/db`, dev |

Postgres image: `postgres:18-alpine` (18 is GA; 14 reaches end of life in November 2026).

Drizzle 1.0 is in release candidates as of August 2026 and 0.45 has been static since March. Plan the upgrade; do not start on the RC.

### Driver

Every server process (the Next app, the Hono server, the worker) runs on Node, so there is one driver: `drizzle-orm/node-postgres` over `pg`. Set `prepare: false` only if a transaction-mode pooler sits in front.

Do not use `postgres` (postgres.js); its maintenance slowed sharply in 2026. Integration tests go through the same `pg` pool under Vitest.

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

- Repository behavior against real Postgres in `libs/db/src/repository.integration.test.ts`. Mocks cannot prove migration behavior or constraints.
- Everything else uses `createMemory<Thing>Repository()`.

## Hubs

- `package.json`: `db:generate` (`pnpm --filter @scope/db exec drizzle-kit generate --config drizzle.config.ts`, because `drizzle-kit` is declared in `libs/db`), `db:migrate` (`node apps/worker/src/migrate.ts`), `db:migrations:check` (`node tools/check-migrations.ts`), `test:integration` (`vitest run --project integration`). In `vitest.config.ts`, split `test.projects` into `unit` (the existing include, excluding `**/*.integration.test.ts`) and `integration` (`libs/**/*.integration.test.ts`), and change `test` to `vitest run --project unit` so `check` never needs a database. Add `db:migrations:check` and `test:integration` to `ci`, not `check`.
- `.eph`:

  ```ini
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

  Add `pre-start=pnpm run db:migrate` to the app blocks, and `roles_order=dep,app` at the top of the file once an app block exists (eph rejects `roles_order` naming a role no service declares). The Claude `SessionStart` hook and Codex setup run `eph up`, so Postgres starts in every worktree.

- `pnpm-workspace.yaml`: `allowBuilds` entry `esbuild: true` (drizzle-kit).

- `.github/workflows/ci.yml`: a `postgres:18-alpine` service on the `ci` job with `DATABASE_URL` (Postgres publishes on 127.0.0.1; a container that must reach it uses `--network host`), `pnpm run db:migrate` before `pnpm run ci`, and a PR-only step `pnpm run db:migrations:check -- --base "${{ github.event.pull_request.base.sha }}"`.
- `secrets/prod.env`: `DATABASE_URL`. Locally `.eph` supplies it from the assigned port.
- `.nudge.yaml`: a `UserPromptSubmit` reminder on `(?i)(database|schema|migration|column|postgres|drizzle)` that says schema changes need generated SQL, matching input schemas, and migration tests. Add positive and negative fixtures and register them in `tools/check-nudge-rules.ts`.
- `AGENTS.md` check classification: "Database schema: edit `libs/db/src/schema.ts`, run `pnpm run db:generate`, inspect the SQL, and add migration tests. Never edit a migration that may already have shipped."
- `AGENTS.md` invariants: "Keep raw SQL and Drizzle access inside `libs/db`. Reach for Postgres before any second datastore."
- Docker (release capability): the entrypoint runs `node apps/worker/src/migrate.ts` only when `RUN_MIGRATIONS=1`, and only the worker image carries `libs/db`; run migrations as a separate release step, not from every replica.
- `tools/check-migrations.ts` needs a base revision. Take `--base <sha>` (CI passes the PR base), fall back to `origin/main`, and skip with a message when neither exists, so `ci` still runs on a clone with no remote.
