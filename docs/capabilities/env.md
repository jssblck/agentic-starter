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
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    },
    emptyStringAsUndefined: true,
    skipValidation: process.env.SKIP_ENV_VALIDATION === '1',
  })
  ```

  Import `./env` in `next.config.ts` so validation runs at build. Client variables must carry `NEXT_PUBLIC_`. With `output: 'standalone'`, add both `@t3-oss/env-nextjs` and `@t3-oss/env-core` to `transpilePackages`.

- `apps/server/src/env.ts`, `apps/worker/src/env.ts`: `createEnv({ server, runtimeEnv: process.env, emptyStringAsUndefined: true })`.
- `apps/cli`: Incur already declares env schemas per command; do not add a second layer.
- `libs` never read the environment. They receive configuration as constructor arguments from the app that decoded it.
- `.env.example` lists every variable with a comment and a safe local value; `.eph` supplies the ones that depend on assigned ports.

## Nudge rule

`env-no-direct-process-env`: on `apps/**/src/**/*.ts` and `apps/web/app/**/*.tsx` and `libs/**/*.ts`, excluding `**/env.ts`, `**/cli.ts` (Incur), and `tools/**`: regex `process\.env\b`; message: "Read configuration from the app's `env` module." Fixtures both ways.

## Hubs

- `AGENTS.md` invariants: "Decode `process.env` once per process in `env.ts`. `libs` receive configuration as arguments."
- `.gitignore` already ignores `.env` and `.env.*` except `.env.example`.
