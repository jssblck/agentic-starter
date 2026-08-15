# Agentic Starter

A base for software projects that several coding agents develop in parallel Git worktrees. It gives a new project a strict Bun and TypeScript foundation, an isolated development environment per worktree, and an agent policy layer from the first commit. It ships no application code; an agent adds capabilities from written guides.

## Start a new project

Create a repository from this template, clone it, and install the toolchain:

- Git
- Bun 1.3.14
- eph
- Docker, when a capability adds containerized services
- Nudge and Bastion, for the policy layer

```sh
bun install --frozen-lockfile
bun run doctor
nudge claude setup   # or: nudge codex setup
```

Then ask a coding agent to use the `bootstrap` skill:

```text
Use the bootstrap skill to turn this template into my new project.
```

The skill interviews you about the product, its identity, which surfaces it exposes (HTTP API, CLI, web UI), persistence, native code, and distribution. It then applies the matching guides from `docs/capabilities` in dependency order, keeping the repository compiling after each one.

## What the base contains

- Bun workspace with a strict `tsconfig`, Oxlint type-aware rules, and Oxfmt.
- `bun run check`: format, lint, typecheck, unit tests. The loop agents run constantly.
- `bun run ci`: `check` plus policy validation and every capability's authoritative check. What CI runs.
- Nudge rules that block type-system escape hatches, fixed development ports, and `npm`/`npx` before the write happens.
- A Bastion reviewer registry with no active reviewers and suggested defaults in comments.
- eph for worktree-local services with assigned ports.
- Claude Code and Codex hooks that fetch, install, and start services in a fresh worktree, and clean up when it is removed.
- `bun run doctor` to report which tools are present.

## Capabilities

Each guide under `docs/capabilities` describes one addition: packages, pinned dependencies, shared-hub edits, invariants, and checks.

1. Web app (Next.js, self-hosted on Node, Base UI and Tailwind) and/or API server (Hono with a typed RPC client, standalone or mounted inside the Next app), chosen by who calls the backend
2. CLI (Incur)
3. PostgreSQL (Drizzle, immutable migrations, worktree-local database)
4. Rust behind Node-API
5. Release (Git-tag versioning, CLI binaries and installers, container images)

The guides were written from a working implementation at the moment it was removed. Nothing verifies them afterward except the next agent that follows one; when a guide proves wrong, fix it in the same commit as the code.

## Review before treating the result as a baseline

An agent can apply identity and code, but it cannot infer ownership or publishing policy. Review `.github/CODEOWNERS`, Bastion authentication and branch protection, license and security contacts, and any registry or installer settings a capability introduced.

## Documents

- [Architecture](docs/architecture.md): design objective, package shape, boundaries, feedback layers.
- [Technology choices](docs/technology.md): why this stack, and what would change the choice.
- [Worktrees](docs/worktrees.md): per-agent isolation of checkouts, services, and state.
- [Capabilities](docs/capabilities/README.md): the add-on guides.
