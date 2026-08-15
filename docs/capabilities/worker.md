# Worker

Background jobs run in a separate long-lived Node process, queued in Postgres through pg-boss. The Next app and the Hono API enqueue; the worker executes. Nothing else is needed until Postgres itself is the bottleneck.

Requires [PostgreSQL](postgres.md).

## Why pg-boss

Of the Postgres-only TypeScript queues with real adoption (pg-boss, graphile-worker), pg-boss has a Drizzle transaction adapter (`fromDrizzle`), a bring-your-own-executor option so it can share the app's connection, a dead-letter queue with `redrive()`, retention and archival built in, and singleton, throttle, and debounce policies. It lacks a typed job registry (graphile-worker has one via declaration merging), so `libs/jobs` supplies a small typed wrapper. LISTEN/NOTIFY is opt-in; enable it.

## Packages

- `libs/jobs`: the job registry and the typed enqueue/handle wrapper. `registry.ts` declares every job as `{ name, schema }` with a Zod schema for its payload; `send.ts` exports `enqueue(tx, job, payload, options)` which parses the payload with the job's schema and calls pg-boss through the Drizzle adapter; `work.ts` exports `handle(boss, job, handler)` which parses incoming data with the same schema before calling the handler. No handler code lives here.
- `apps/worker`: thin Node entrypoint. Reads env, constructs the database and pg-boss, registers each handler from `libs/*` through `handle`, starts, and drains on `SIGTERM`.
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

  `enqueue` wraps `new PgBoss({ db: fromDrizzle(tx, sql) })`-style adapter usage; see pg-boss's `docs/api/adapters.md`. Server actions and Hono routes both call it.

- The worker constructs one `PgBoss` with `useListenNotify: true`, creates each queue with `notify: true`, `retryLimit`, `retryBackoff: true`, and a `deadLetter` queue, then `boss.work(name, { localConcurrency }, handler)`.
- Handlers are idempotent. A job may run twice; design for it (upserts, idempotency keys, check-then-act inside a transaction).
- Payloads carry ids, not rows. The handler reloads what it needs.
- Long jobs call the heartbeat pg-boss provides, or split into smaller jobs.
- Cron uses `boss.schedule(name, cron, data, { tz })`; a schedule enqueues an ordinary job, so the handler is the same code.
- Shutdown: on `SIGTERM`, `await boss.stop({ graceful: true, timeout: 30_000 })`, then close the database. Match the timeout to the platform's stop grace period.
- pg-boss holds one dedicated connection for LISTEN. It must not go through a transaction-mode pooler.

## Schema and migrations

pg-boss owns the `pgboss` schema and migrates it on `start()` under an advisory lock. In production, run the worker with `migrate: false` and apply pg-boss's migrations as a release step (`pg-boss` CLI with `--dry-run` emits reviewable SQL), the same way app migrations run. Drizzle never sees the `pgboss` schema; if `drizzle-kit push` or `pull` is ever used, `schemaFilter` must exclude it.

## Tests

- Handlers: Vitest with in-memory repositories; no pg-boss.
- The registry: a test that every job's schema round-trips a sample payload.
- One integration test in `tests/integration` that enqueues through the adapter and runs `boss.work` once against real Postgres. It runs in `ci`.

## Hubs

- `package.json`: `dev:worker` (`node --watch apps/worker/src/main.ts`), `start:worker` (`node apps/worker/src/main.ts`).
- `.eph`: `[worker]` block with `run=node --watch apps/worker/src/main.ts`, `role=app`; no port. It shares `DATABASE_URL`.
- `AGENTS.md` invariants: "Enqueue jobs inside the transaction that creates the data they reference. Handlers live in `libs`, are idempotent, and receive ids. Only `apps/worker` calls `boss.work`."
- `AGENTS.md` check classification: "Jobs: run the handler tests and the registry test; run `test:integration` when the queue configuration changes."
- Docker (release capability): a second image or a second `CMD` on the same image running `node dist/worker.js`; on Railway, a second service from the same repo.

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
