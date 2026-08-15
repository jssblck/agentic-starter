# Observability

LogTape for structured logs, OpenTelemetry for traces, Sentry for errors. Libraries log through namespaced loggers and configure nothing; each process configures once at boot and decides where records go.

## Dependencies

| Package                                                              | Version | Where                                          |
| -------------------------------------------------------------------- | ------- | ---------------------------------------------- |
| `@logtape/logtape`                                                   | 2.3.1   | every `libs/*` that logs, every `apps/*`       |
| `@logtape/pretty`                                                    | 2.3.1   | `apps/*`, development sink                     |
| `@logtape/otel`                                                      | 2.3.1   | `apps/*`, production sink                      |
| `@logtape/hono`                                                      | 2.3.1   | `libs/api`, request logging with request ids   |
| `@logtape/drizzle-orm`                                               | 2.3.1   | `libs/db`, query logging when wanted           |
| `@logtape/testing-vitest`                                            | 2.3.1   | dev, assert on log records in tests            |
| `@vercel/otel`                                                       | 2.1.3   | `apps/web`; works self-hosted, per Next's docs |
| `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http` | 0.221.0 | `apps/server`, `apps/worker`                   |
| `@opentelemetry/auto-instrumentations-node`                          | 0.79.0  | `apps/server`, `apps/worker`                   |
| `@hono/otel`                                                         | 1.1.2   | `libs/api`, one server span per request        |
| `@sentry/nextjs`                                                     | 10.70.0 | `apps/web`, optional                           |

LogTape core has zero dependencies and one maintainer. The sinks pull their own dependencies (`@logtape/otel` brings the OpenTelemetry SDK).

## Logging

- Every library: `const logger = getLogger(['<project>', '<lib>'])` at module scope. Never `configure()` in a library.
- Message form: `logger.info('Created note {noteId} for {orgId}', { noteId, orgId })`. Placeholders become structured properties. Do not use tagged template literals; they carry no structure. Do not interpolate values into the message string.
- Every process calls `configure()` once at boot, in `apps/*/src/main.ts` (Hono server, worker) or `instrumentation.ts` `register()` (Next, server side). A second `configure()` throws; in Next dev with hot reload use `configure({ reset: true, ... })`. Multi-bundle behavior is not documented by LogTape; treat "once per process, reset in dev" as the rule and report anything stranger.
- Sinks: `getConsoleSink({ formatter: getPrettyFormatter() })` in development; in production `getConsoleSink({ formatter: getJsonLinesFormatter() })` (one JSON object per line, what log shippers expect) plus `getOpenTelemetrySink({ serviceName })` when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Declare the sink map with fixed keys and use a no-op sink (`() => {}`) for a disabled one; the `loggers` entries reference keys by name and the config type rejects an optional key.
- Request ids: `configure({ contextLocalStorage: new AsyncLocalStorage(), ... })` (required on Node for implicit context, and silently ignored without it), then `@logtape/hono`'s `honoLogger({ category, context: true })` reads or generates `x-request-id`, echoes it, and attaches `requestId` to every record in the request. Register it inside the chain, after `basePath` and before the routes. In Next, wrap server action bodies with `withContext({ requestId })` where it matters. In the worker, `withContext({ jobId, jobName })` around each handler.
- Redaction: `@logtape/redaction` for known secret-shaped fields if logs leave the box. Better: never log request bodies or tokens.
- Levels: `debug` for developer detail, `info` for one line per unit of work, `warning` for handled anomalies, `error` for failures with the error object as a property. Category-level filters in `configure()`, not `if` statements at call sites.

## Tracing

- Next: `apps/web/instrumentation.ts` with `export function register() { registerOTel({ serviceName }) }` from `@vercel/otel`. That covers route rendering, server actions, and fetch spans. `NEXT_OTEL_VERBOSE=1` for more spans; `NEXT_OTEL_FETCH_DISABLED=1` to drop fetch spans.
- Hono standalone and worker: `NodeSDK` from `@opentelemetry/sdk-node` started before anything else imports `pg`, with the OTLP HTTP trace exporter and auto-instrumentations for `pg` and `http`. Put it in its own module and load it with `node --import ./apps/worker/src/tracing.ts`, not with an `import` at the top of `main.ts`: ESM evaluates imports in source order, and the repository's formatter sorts imports, so that ordering is not stable. Start the SDK only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; an exporter with no endpoint retries against localhost forever. `@hono/otel`'s `httpInstrumentationMiddleware` for the request span; it does not set up a provider itself.
- Export target: whatever the platform ingests over OTLP (Railway supports an OTLP collector; a bare server runs one). Configure with the standard `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_SERVICE_NAME` variables so no code changes between environments.
- Correlation: `@logtape/otel` attaches the active trace and span ids to each log record when a provider is registered.

## Errors

`@sentry/nextjs` supports Next 16 and Turbopack. Add it when a product has users; the wizard's config is fine, source maps upload by default under Turbopack. For the worker and standalone server, `@sentry/node`. Sentry and OTLP traces overlap; if both are on, let Sentry sample errors and OTel own performance.

## Hubs

- `env` module: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `LOG_LEVEL`, `SENTRY_DSN` (optional).
- `pnpm-workspace.yaml`: `allowBuilds` entry `protobufjs: false` (pulled in by the OTLP exporters).
- `.eph` `[env]`: `LOG_LEVEL=debug`; no OTLP endpoint locally unless a collector is running.
- `AGENTS.md` invariants: "Log through `getLogger([...])` with placeholder properties. Configure sinks only in an app entrypoint. Never log tokens, secrets, or request bodies."
- `.oxlintrc.json`: consider `@logtape/lint` rules if the project standardizes on them; otherwise `no-console` error outside `tools/`. Next's `instrumentation.ts` needs the same exception: its fatal message runs before any sink exists.
- Two apps configuring the same sinks drift. Put `configureLogging(options)` in a `libs/logging` package that takes the service name, level, endpoint, and a `reset` flag, and let each entrypoint call it once. The sink map needs fixed keys with a no-op sink for a disabled one, because `loggers` entries reference sinks by name and the config type rejects an optional key.
