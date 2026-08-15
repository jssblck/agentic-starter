# Architecture

## Design objective

The optimization target is guardrails per second across several speculative worktrees. Agents multiply every feedback loop across every branch, so feedback that arrives before or during an edit, from a check that finishes in seconds, is the target.

The base therefore contains only what every derived project keeps:

- Node.js, pnpm, and TypeScript as the control plane, with a strict compiler configuration, type-aware linting, and Vitest. Node runs TypeScript directly, so the base has no build step.
- One fast check (`pnpm run check`) and one full gate (`pnpm run ci`).
- Nudge for deterministic policy at write time, Bastion for semantic review after a changeset exists.
- eph for worktree-local services with assigned ports.
- Agent hooks that make a fresh worktree usable without human setup.

Application code, persistence, native code, and distribution are capabilities a project adds through `docs/capabilities`.

## Shape of a derived project

```text
apps/*  ---> libs/*  ---> external systems
```

`apps` are entrypoints. Each owns one surface (process, HTTP, DOM), parses input from it, constructs dependencies, calls a library, and renders the result back to that surface. They contain no business logic and are tested only for parsing and wiring.

`libs` hold dependency-injected workflows and domain types. They are tested with Vitest and in-memory implementations of their dependencies. A library that talks to an external system (database, native addon, network) owns that boundary and decodes what crosses it.

Nothing in `libs` imports from `apps`. Nothing outside a boundary library touches the raw external interface.

## Boundaries and trust

Static types cannot prove external bytes. Every value that enters from the environment, the network, a database driver, or a native addon is `unknown` until a decoder in the owning library proves its shape. Keep the unsafe interop in one named file and make the resulting interface smaller than the library it wraps.

Prefer tagged unions with exhaustive switches for lifecycle states, branded types when two strings mean different things, and constructors that make invalid values unrepresentable.

## Feedback layers

| Layer             | Runs                      | Catches                                                                               |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| Nudge             | before a write, and in CI | mechanically decidable violations: escape hatches, fixed ports, wrong package manager |
| TypeScript        | `check`                   | shape and exhaustiveness                                                              |
| Oxlint            | `check`                   | unsafe operations, unhandled promises, import hygiene                                 |
| Vitest            | `check`                   | behavior, with in-memory dependencies                                                 |
| Capability checks | `ci`                      | migrations, native builds, release matrices, integration                              |
| Bastion           | after a changeset         | semantic invariants a rule cannot express                                             |

A Nudge rule must be true or false with no judgment. Nudge globs (0.5.1) have no negation and no brace alternation, and both fail silently: a rule that needs an exception is expressed by placing the exempt files outside the include globs, with one `on:` entry per glob and tool. Anything that needs judgment is a Bastion reviewer, and a reviewer covers one concern. Do not move a rule between layers because it is easier to write there.

## Worktrees

Each agent works in one complete Git worktree. Branch-sensitive state (dependency links, build output, databases, ports) is per worktree; immutable package bytes are hard-linked from pnpm's content-addressable store, so worktrees share them without a shared `node_modules`. `.npmrc` selects the isolated linker so an undeclared dependency fails locally the way it fails in a fresh clone.

The Claude `SessionStart` hook and the Codex setup script fetch `origin/main`, install locked dependencies, and start eph services. They do not rebase; that decision belongs to the agent once it has looked at the branch. `WorktreeRemove` and Codex cleanup run `eph clean` so a removed worktree takes its containers and volumes with it.

Never share a `node_modules` directory or a build output directory between worktrees by symlink.

Shared agent skills are a dependency like any other: `pnpm install` installs the current `jssblck/agents` into the ignored `.agents/skills` and `.claude/skills` directories through `npx skills`, and `pnpm run skills:update` refreshes them. The CLI's `skills-lock.json` records what was installed but cannot pin it, so it is ignored rather than committed. Repository-specific skills (`bootstrap`, `using-eph`, and the like) stay tracked next to them.

Secrets are sops-encrypted dotenv files committed per environment. Every checkout has them; the user-wide `agent` age key decrypts dev, and a gitignored per-checkout file elevates one worktree to prod. Production services hold only the `prod` key and decrypt at boot, so secrets ship with the commit that needs them. See [Secrets](secrets.md).
