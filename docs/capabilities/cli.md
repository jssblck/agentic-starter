# CLI

Incur defines commands, options, environment variables, help, version, and structured output from Zod schemas. The executable stays thin: parse process input, construct dependencies, call `libs`, render the result.

## Packages

- `apps/cli`: `cli.ts` exports `createCli(dependencies)` and a default `Cli` instance; `main.ts` is the executable entrypoint and only calls `cli.serve()`. Keep them separate: a Bun entrypoint that default-exports an object with a `fetch` handler auto-starts a server, and Incur's `Cli` has one.

## Dependencies

| Package | Version | Where      |
| ------- | ------- | ---------- |
| `incur` | 0.4.17  | `apps/cli` |

Add `"bin": { "<name>": "./src/main.ts" }` to `apps/cli/package.json`.

## Shape

- `Cli.create('<name>', { version: VERSION, description })`. Each `cli.command(name, { description, args, options, env, output, run })` declares its schemas; Incur renders help and validates input.
- Inject the API client (or any service) through a `dependencies` object so command tests call `createCli({ createApi: () => inMemoryApi })` and never spawn a process.
- Environment schemas carry the project prefix (`<PREFIX>_API_URL`). Give them `.describe()` text; Incur prints it in help.
- Incur also exposes a Fetch and MCP surface. If the project wants it, add a `serve` command that binds explicitly to `HOST` and `PORT` (default port 0) through an injected `startHttpServer`, and refuse to run it when the command arrives over HTTP.

## Tests

- `apps/cli/src/main.test.ts`: construct the CLI with in-memory dependencies and invoke commands directly. Assert on returned structured output, not on stdout.

## Hubs

- `package.json`: add `"cli": "bun apps/cli/src/main.ts"`.
- `.eph`: only if the Fetch surface is used: a `[<name>]` block with `run=bun apps/cli/src/main.ts serve`, `role=app`, `port=auto`, `env.PORT=${<name>.port}`.
- `AGENTS.md` invariants: "Define commands, options, environment variables, help, and version handling with Incur in `apps`. Keep Incur definitions in `cli.ts` and executable entrypoints in `main.ts`."

## Distribution

Standalone binaries and installers belong to the [release](release.md) capability.
