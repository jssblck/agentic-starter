# Worker

Background jobs run in a separate long-lived Node process, queued in Postgres through pg-boss. The Next app and the Hono API enqueue; the worker executes. Nothing else is needed until Postgres itself is the bottleneck.

Requires [PostgreSQL](postgres.md).

## Why pg-boss

Of the Postgres-only TypeScript queues with real adoption (pg-boss, graphile-worker), pg-boss has a Drizzle transaction adapter (`fromDrizzle`), a bring-your-own-executor option so it can share the app's connection, a dead-letter queue with `redrive()`, retention and archival built in, and singleton, throttle, and debounce policies. It lacks a typed job registry (graphile-worker has one via declaration merging), so `libs/jobs` supplies a small typed wrapper. LISTEN/NOTIFY is opt-in; enable it.

## Packages

- `libs/jobs`: the job registry and the typed enqueue/handle wrapper. `registry.ts` declares every job as `{ name, schema }` with a Zod schema for its payload (`T extends object`; pg-boss data is an object). `send.ts` exports `createSender(connectionString)` returning `{ enqueue(tx, job, payload, options), close }`; `enqueue` parses the payload with the job's schema and calls pg-boss through the Drizzle adapter. `work.ts` exports `ensureQueues(boss, jobs)` and `handle(boss, job, handler)`, which parses incoming data with the same schema before calling the handler. No handler code lives here.
- `apps/worker`: thin Node entrypoint (`src/main.ts`) plus `env.ts` beside `src/` (see [Environment](env.md)) and `src/migrate.ts`, the deploy step that applies the app's migrations. `main.ts` reads env, constructs the database and pg-boss, registers each handler from `libs/*` through `handle`, starts, and drains on `SIGTERM`.
- Handlers themselves live next to the domain they serve in `libs` (`libs/<domain>/jobs/*.ts`), take injected dependencies, and are unit-tested without pg-boss.

## Dependencies

| Package   | Version | Where                      |
| --------- | ------- | -------------------------- |
| `pg-boss` | 12.27.0 | `libs/jobs`, `apps/worker` |
| `zod`     | 4.4.3   | `libs/jobs`                |

pg-boss requires Node 22.12+ and Postgres 13+. It depends on `pg` itself; the same driver `libs/db` uses.

## Shape

- Enqueue inside the caller's Drizzle transaction so the job commits with the data it refers to:

  ```ts
  await db.transaction(async (tx) => {
    const thing = await things.create(tx, input)
    await enqueue(tx, jobs.indexThing, { thingId: thing.id })
  })
  ```

  The sender side is its own construction: `import { PgBoss, fromDrizzle } from 'pg-boss'` (named exports; there is no default), `new PgBoss({ connectionString, supervise: false, schedule: false, migrate: false })`, and `boss.send(name, data, { db: fromDrizzle(tx, sql) })`. A sender still needs `await boss.start()` once before the first send (pg-boss reads its queue cache through its own connection and asserts otherwise), so `createSender` memoizes a lazy `start()` promise inside `enqueue`. That is what lets a Next server bundle construct it at module scope. Server actions and Hono routes both call it.

  Enqueue from a repository hook (`createNoteRepository(db, { onCreated: (tx, note) => enqueue(...) })`) so the app wires the job without the repository knowing pg-boss.

- Queues must exist before the first `send` ("Queue X does not exist"), and a queue's dead-letter queue must exist before the queue that names it. `ensureQueues` creates `<name>.dead` then `<name>` (`notify: true`, `retryLimit`, `retryBackoff: true`, `deadLetter`) for every registry entry; it is idempotent. Run it at worker boot and from the migration step, so a fresh database accepts sends before any worker has run.
- The worker constructs one `PgBoss` with `useListenNotify: true`, runs `ensureQueues`, then `boss.work(name, { localConcurrency }, handler)` for each job. `work` receives a batch array; iterate it. `migrate` is `false` in production and true on a developer machine; derive it from the app environment rather than adding a flag.
- `pg-boss` 12 exports `PgBoss`, `fromDrizzle`, and the `Queue`/`SendOptions` types from the package root, and `fromDrizzle(tx, sql)` takes drizzle's `sql` tag as its second argument so pg-boss keeps no runtime dependency on Drizzle. Type the transaction as pg-boss's own `DrizzleTransactionLike` so `libs/jobs` does not have to depend on `libs/db`.
- Handlers are idempotent. A job may run twice; design for it (upserts, idempotency keys, check-then-act inside a transaction).
- Payloads carry ids, not rows. The handler reloads what it needs.
- Long jobs call the heartbeat pg-boss provides, or split into smaller jobs.
- Cron uses `boss.schedule(name, cron, data, { tz })`; a schedule enqueues an ordinary job, so the handler is the same code.
- Shutdown: on `SIGTERM` and `SIGINT`, `await boss.stop({ graceful: true, timeout: 30_000 })`, close the database, then `process.exit(0)`. Memoize the stop promise: a second signal calling `pool.end()` again throws "Called end on pool more than once". Match the timeout to the platform's stop grace period.
- pg-boss holds one dedicated connection for LISTEN. It must not go through a transaction-mode pooler.

## Schema and migrations

pg-boss owns the `pgboss` schema and migrates it on `start()` under an advisory lock. In production, run the worker with `migrate: false` and apply pg-boss's migrations as a release step (`pg-boss` CLI with `--dry-run` emits reviewable SQL), the same way app migrations run. Drizzle never sees the `pgboss` schema; if `drizzle-kit push` or `pull` is ever used, `schemaFilter` must exclude it.

## Tests

- Handlers: Vitest with in-memory repositories; no pg-boss.
- The registry: a test that every job's schema round-trips a sample payload.
- One integration test, `libs/jobs/src/queue.integration.test.ts`, that enqueues through the adapter and runs `boss.work` once against real Postgres. It uses a private queue named `test.<uuid>` created on the fly: a running dev worker (the eph `[worker]` block) on the same database would otherwise consume the job first and the test would time out. It runs in `ci`.

## Hubs

- `package.json`: `dev:worker` (`node --watch apps/worker/src/main.ts`), `start:worker` (`node apps/worker/src/main.ts`).
- `.eph`: `[worker]` block with `run=node tools/secrets.ts exec dev -- node --import ./apps/worker/src/tracing.ts --watch apps/worker/src/main.ts`, `role=app`; no port. (The `--import` is [Observability](observability.md); without that capability it is just `node --watch`.) eph injects the resolved top-level variables into `run=` processes, so `DATABASE_URL` from `[env]` arrives without repeating it; the secrets wrapper passes them through and adds the decrypted dev values.
- `AGENTS.md` invariants: "Enqueue jobs inside the transaction that creates the data they reference. Handlers live in `libs`, are idempotent, and receive ids. Only `apps/worker` calls `boss.work`."
- `AGENTS.md` check classification: "Jobs: run the handler tests and the registry test; run `test:integration` when the queue configuration changes."
- Docker (release capability): its own image built by the container recipe in [Release](release.md) with `--filter @scope/worker...` and `CMD ["node", "tools/secrets.ts", "exec", "prod", "--", "node", "apps/worker/src/main.ts"]`; on Railway, a second service from the same repo.

## Bastion reviewer

Add commented out, like the base defaults:

```yaml
reviewers:
  - name: jobs-discipline
    trigger: ['libs/jobs/**', 'libs/**/jobs/**', 'apps/worker/**', 'apps/web/app/**', 'libs/api/**']
    mode: gate
    backend: codex
    prompt: |
      Review job-related changes. Flag:
      1. An enqueue outside the transaction that creates the rows the job
         will read, or an enqueue of full rows instead of ids.
      2. A handler that is not safe to run twice (no upsert, no idempotency
         key, no check inside a transaction).
      3. A job added to the registry without a Zod schema, or a handler
         that reads job.data without going through the registry wrapper.
      4. Work that should be a job (network calls, batch writes, anything
         over a second) done inline in a server action or route handler.
      Pass when none apply.
```
