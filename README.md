# Agentic Starter

A base for software projects that several coding agents develop in parallel Git worktrees. It gives a new project a strict Node.js and TypeScript foundation, an isolated development environment per worktree, and an agent policy layer from the first commit. It ships no application code; an agent adds capabilities from written guides.

## Start a new project

Create a repository from this template, clone it, and install the toolchain:

- Git
- Node.js 24 or later
- pnpm 11
- eph
- sops, and age for generating keys
- Docker, when a capability adds containerized services
- Nudge and Bastion, for the policy layer

```sh
pnpm install --frozen-lockfile
pnpm run doctor
nudge claude setup   # or: nudge codex setup
```

Then ask a coding agent to use the `bootstrap` skill:

```text
Use the bootstrap skill to turn this template into my new project.
```

The skill interviews you about the product, its identity, which surfaces it exposes (HTTP API, CLI, web UI), persistence, background jobs, auth and billing, observability, native code, and distribution. It then applies the matching guides from `docs/capabilities` in dependency order, keeping the repository compiling after each one.

## What the base contains

- pnpm workspace with a strict `tsconfig`, Oxlint type-aware rules, Oxfmt, and Vitest. TypeScript runs on Node directly; there is no build step for tools or tests.
- `pnpm run check`: format, lint, typecheck, unit tests. The loop agents run constantly.
- `pnpm run ci`: `check` plus policy validation and every capability's authoritative check. What CI runs.
- Nudge rules that block type-system escape hatches, fixed development ports, and `npm`/`yarn`/`bun` package commands before the write happens.
- A Bastion reviewer registry with no active reviewers and suggested defaults in comments.
- eph for worktree-local services with assigned ports.
- sops-encrypted secrets committed per environment, with a user-wide agent key for dev and per-checkout elevation for prod (`docs/secrets.md`).
- Claude Code and Codex hooks that fetch, install, and start services in a fresh worktree, and clean up when it is removed.
- `pnpm run doctor` to report which tools are present.
- Shared agent skills from [jssblck/agents](https://github.com/jssblck/agents), installed into `.agents/skills` and `.claude/skills` by `pnpm install`. Every checkout, worktree, and cloud sandbox gets them without machine-level setup.

## Capabilities

Each guide under `docs/capabilities` describes one addition: packages, pinned dependencies, shared-hub edits, invariants, and checks.

1. Environment (typed `process.env` decoding at boot)
2. Web app (Next.js, self-hosted on Node, Base UI and Tailwind) and/or API server (Hono with a typed RPC client, standalone or mounted inside the Next app), chosen by who calls the backend
3. CLI (Incur, compiled to a standalone binary with Bun at release time)
4. PostgreSQL (Drizzle, immutable migrations, worktree-local database)
5. Worker (pg-boss jobs in Postgres)
6. Auth and billing (Clerk)
7. Observability (LogTape, OpenTelemetry, Sentry)
8. Rust behind Node-API
9. Release (Git-tag versioning, CLI binaries and installers, container images)

Each guide was exercised by a throwaway project on the current base before it was deleted. Nothing verifies them afterward except the next agent that follows one; when a guide proves wrong, fix it in the same commit as the code.

## Review before treating the result as a baseline

An agent can apply identity and code, but it cannot infer ownership or publishing policy. Review `.github/CODEOWNERS`, Bastion authentication and branch protection, license and security contacts, and any registry or installer settings a capability introduced.

## Documents

- [Architecture](docs/architecture.md): design objective, package shape, boundaries, feedback layers.
- [Technology choices](docs/technology.md): why this stack, and what would change the choice.
- [Worktrees](docs/worktrees.md): per-agent isolation of checkouts, services, and state.
- [Secrets](docs/secrets.md): encrypted secrets in the repository, agent access, elevation, production.
- [Capabilities](docs/capabilities/README.md): the add-on guides.
