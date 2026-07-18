# Getting started with the example stack

This document installs the toolchain and runs the example todo application end to end. The application is disposable demonstration code: if you are starting a real project, begin with the [README](../README.md) and the [customization guide](customizing.md), then use this page to verify the toolchain and whichever example capabilities you keep.

## Install tools

Required:

- Git
- Bun 1.3.14
- Rust 1.97.1 with rustfmt and clippy
- Docker or a compatible container engine
- eph

Policy tooling:

- Nudge
- Bastion
- the backend CLI selected in `.bastion.yaml` (Codex in this template)

Use the upstream installers rather than copying binaries into the repository. Run `bun run doctor` afterward.

## Initialize the repository

```sh
bun install --frozen-lockfile
cargo check --workspace --locked
bun run native:ensure
```

`bun.lock` and `Cargo.lock` are committed. Use frozen Bun installs and locked Cargo commands so local, CI, and release dependency graphs agree.

## Start a worktree-local stack

```sh
eph dev
```

The `.eph` roles make Postgres a dependency tier and the Elysia server an application tier. Postgres reaches healthy state first. The server's `pre-start` hooks materialize the native addon and run migrations. The application receives an assigned `PORT` and a matching `DATABASE_URL`.

To use the resolved values in a second terminal:

```sh
eval "$(eph env)"
```

Useful commands:

```sh
bun run cli -- list
bun run cli -- add "Read architecture docs @office #onboarding"
curl "$TODO_API_URL/health"
```

## Install hooks and agent skills

```sh
nudge codex setup
nudge claude setup
bastion skills install
eph skills install
```

Nudge project rules are already present in `.nudge.yaml`. Bastion reviewers are already present in `.bastion.yaml`. The setup commands connect them to the local agent environments.
