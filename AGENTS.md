# Agent directives

This repository is optimized for several coding agents working in separate Git worktrees. Preserve that property while changing it.

## Read first

1. Read `docs/architecture.md` before editing.
2. Run `pnpm run doctor` to see which local tools are available.
3. Run `eph up` only when the task needs local services. Every worktree gets isolated containers and ports.
4. On a fresh clone with no application code, use the `bootstrap` skill.

## Checks

- `pnpm run check` is the fast loop: format, lint, typecheck, unit tests. Run it after every coherent edit.
- `pnpm run ci` is the full gate: `check` plus policy validation and every capability's authoritative check. Run it before opening a pull request. CI runs the same command.
- Capabilities add steps to `ci`, not to `check`, unless the step finishes in seconds without external services or toolchains.

Classify the change so you run only what it needs:

- TypeScript-only: `pnpm run check`.
- Policy (`.nudge.yaml`, `.bastion.yaml`, `.eph`, hooks): `pnpm run policy:check`.
- Capability-specific classifications are appended here by the capability guides in `docs/capabilities`.

## TypeScript invariants

- Keep `apps` as thin entrypoints: parse inputs from the surface they own (process, HTTP, DOM), construct dependencies, invoke `libs`, and render output back to that surface. Business logic and testable workflows belong in dependency-injected libraries.
- Do not introduce `any`, TypeScript suppression comments, non-null assertions, or double assertions.
- Treat all external data as `unknown` until a boundary decoder proves its shape.
- Represent finite states with tagged unions and handle them exhaustively.
- Generated files are outputs. Change their source and regenerate them.
- Declare every imported package in the workspace that imports it. The isolated linker hides transitive packages locally but a fresh clone will not resolve them.

## Agent feedback loops

Nudge catches deterministic violations before writes and in CI. Bastion reviews semantic invariants after a coherent changeset exists; the base ships no active reviewers, only suggested defaults in `.bastion.yaml`. Do not move a deterministic rule into an agent reviewer because it is easier to write as prose. Reviewers are single-concern: address blocking findings within a reviewer's scope, and when a reviewer drifts into style or unrelated design, refine its prompt rather than accumulating exceptions in application code.

Skills live in `.agents/skills`; `.claude/skills` holds symlinks into it. Add a skill in one place and link it.

When a debugging incident yields a durable repository-specific lesson, record it with `nudge learn add` and include the problem, fix, and verification. Do not store generic language advice or temporary task state.

## Adding capabilities

Use the `bootstrap` skill and the guides in `docs/capabilities`. Add a capability as one complete unit: packages, dependencies, hub entries, invariants, checks, and docs in the same changeset. Delete one the same way.
