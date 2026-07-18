# Worktrees

## One checkout per agent

Use one complete Git worktree for each agent or speculative branch:

```sh
git worktree add ../worktrees/agent-42 -b agent/42 main
```

A change that modifies TypeScript and Rust belongs in one worktree and one commit series. Separate language-specific worktrees make interface changes non-atomic and move integration failures later.

## Bun state

Each checkout has its own `node_modules` link graph. `bunfig.toml` selects the isolated linker so undeclared dependencies do not become accidentally visible. Bun's global store shares immutable package bytes across worktrees.

Never share one mutable `node_modules` directory by symlink. The package graph and workspace links are branch state.

## Postgres and ports

`.eph` gives every checkout a distinct container project, named volume, and random host port. It also allocates the server port and injects both values into the application.

```sh
eph up --role dep   # prewarm Postgres

eph up              # adopt Postgres, migrate, start server, CLI, and web

eph down            # stop what this session started

eph clean            # remove this worktree's service data
```

Do not add fixed development ports to application configuration. Tests that need a fixed port should bind to loopback port zero or let eph allocate one.

## Native build state

Do not point concurrent worktrees at a shared `CARGO_TARGET_DIR`. Cargo's incremental files and build-script outputs are mutable and branch-sensitive.

`tools/native-cache.ts` shares only completed `.node` artifacts. Its key contains:

- Rust source and Cargo manifests;
- Cargo lockfile;
- Rust toolchain file;
- native package metadata;
- target triple;
- debug or release profile;
- resolved application version.

A per-key directory lock prevents several agents from compiling the same artifact simultaneously. A worktree receives a hard link when possible and a copy otherwise.

## Secrets

A linked Git worktree does not inherit ignored files from another checkout. Do not assume the main checkout's `.env` exists. Prefer eph-resolved local values and a user-level secret manager. When a worktree requires a local secret file, have the bootstrap tool create or link it explicitly.
