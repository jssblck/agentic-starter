# Environment

Every process decodes `process.env` once at boot through a Zod schema and exports a typed object. Application code imports that object; it never reads `process.env` directly. Missing or malformed variables fail at boot (or at build for the Next app), not at first use.

This is a base convention, not an optional capability; every capability guide lists the variables it adds.

## Dependencies

| Package              | Version | Where                                    |
| -------------------- | ------- | ---------------------------------------- |
| `@t3-oss/env-nextjs` | 0.13.11 | `apps/web`                               |
| `@t3-oss/env-core`   | 0.13.11 | `apps/server`, `apps/worker`, `apps/cli` |
| `zod`                | 4.4.3   | each                                     |

Both accept Zod 4 (Standard Schema). For a process without a client bundle, `env-core` with `server` and `runtimeEnv: process.env` is enough; a hand-written `EnvSchema.parse(process.env)` is an acceptable substitute there. Next needs `env-nextjs` for the server/client split.

## Shape

- `apps/web/env.ts`:

  ```ts
  export const env = createEnv({
    server: { DATABASE_URL: z.url(), CLERK_SECRET_KEY: z.string().min(1) /* ... */ },
    client: { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1) },
    experimental__runtimeEnv: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
    },
    emptyStringAsUndefined: true,
    skipValidation: process.env['SKIP_ENV_VALIDATION'] === '1',
  })
  ```

  Bracket access is what `noPropertyAccessFromIndexSignature` requires; Next still inlines `NEXT_PUBLIC_*` for a literal key. Client variables must carry `NEXT_PUBLIC_`. With `output: 'standalone'`, add both `@t3-oss/env-nextjs` and `@t3-oss/env-core` to `transpilePackages`.

  Do not import the env module from `next.config.ts`. `next build` already evaluates every route module that imports it, and `next typegen` (which runs in `check`) would need every server variable too. Run `typegen` and `build:web` with `SKIP_ENV_VALIDATION=1`; validation happens at boot. Note that a _throw_ inside Next's `instrumentation.ts` does not stop the server (see [Web app](web-app.md)), but `process.exit(1)` does. Import the env module dynamically inside `register()` and exit on failure; that keeps one source of truth and needs no separate env-check script in the image:

  ```ts
  const { env } = await import('@/env').catch((error: unknown) => {
    console.error(`environment is invalid: ${String(error)}`)
    process.exit(1)
  })
  ```

  Next also compiles `instrumentation.ts` for the Edge runtime and warns that `process.exit` is unavailable there. The warning is expected on a Node deployment; the build still succeeds. Local processes and containers start through `pnpm secrets exec <env> --` so the decrypted values are in `process.env` before the schema runs.

- `apps/server/env.ts`, `apps/worker/env.ts`: `createEnv({ server, runtimeEnv: process.env, emptyStringAsUndefined: true })`. Keep the env module **beside** `src/`, not inside it. That placement is what excludes it from the Nudge rule below, which cannot express an exception.
- `apps/cli`: Incur already declares env schemas per command; do not add a second layer.
- `libs` never read the environment. They receive configuration as constructor arguments from the app that decoded it. That includes integration tests under `libs/`: put the value in `test.provide` in `vitest.config.ts` (which may read `process.env`) and read it with `inject('databaseUrl')`. Declare the shape with a `declare module 'vitest' { interface ProvidedContext { ... } }` block inside `vitest.config.ts`; a standalone `.d.ts` needs a module marker that `unicorn/require-module-specifiers` rejects.
- Secret values live in `secrets/<env>.env` ([Secrets](../secrets.md)); `.eph` supplies the ones that depend on assigned ports; everything else has a schema default. There is no `.env.example`: the schema is the list.

## Nudge rule

`env-no-direct-process-env`: regex `process\.env\b`; message: "Read configuration from the app's `env` module." Fixtures both ways.

Nudge has no exclusion syntax, so the file set is expressed entirely by what the include globs reach: `apps/**/src/**/*.ts`, `apps/web/app/**/*.ts`, `apps/web/app/**/*.tsx`, `libs/**/*.ts`. Each glob needs its own `on:` entry, twice (`Write` with `content`, `Edit` with `new_content`), so this one rule is eight entries.

Two things about Nudge globs, both verified against `nudge` 0.5.1 and both silent failures rather than errors:

- `!(...)` at the top level fails to parse the rule at all; `!(name).ts` inside a path validates and then matches nothing.
- Brace alternation (`{apps,libs}/**/*.ts`) validates and matches nothing.

So an "everything except" rule is not expressible. Place the files that must be exempt outside the include globs instead: `apps/*/env.ts` rather than `apps/*/src/env.ts`, and `tools/**` for anything else that legitimately reads the environment (a migration entrypoint is better placed in an app, see [PostgreSQL](postgres.md)).

A rule that matches on path alone still needs a content matcher; `(?s)^.*$` is the catch-all.

## Hubs

- `AGENTS.md` invariants: "Decode `process.env` once per process in `env.ts`. `libs` receive configuration as arguments."
- `.gitignore` already ignores `.env` and `.env.*` so a stray file never lands in a commit.
