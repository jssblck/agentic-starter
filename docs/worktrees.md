# Worktrees

## One checkout per agent

```sh
git worktree add ../worktrees/agent-42 -b agent/42 main
```

A change that spans several packages belongs in one worktree and one commit series. Splitting it across worktrees makes interface changes non-atomic and moves integration failures later.

## What the hooks do

Claude Code's `SessionStart` hook and Codex's setup script run the same three steps: fetch `origin/main`, `pnpm install --frozen-lockfile`, `eph up`. They stop when any step fails. They do not rebase the branch; look at the branch, then decide.

Neither tool copies `node_modules`. `.worktreeinclude` lists ignored files to copy into a new worktree; the base lists none, because secrets are committed encrypted (see below) and shared skills are installed by `pnpm install`.

`WorktreeRemove` and Codex cleanup run `eph clean`, which removes the worktree's containers, volumes, and saved eph state.

## Dependency state

Each checkout has its own `node_modules` link graph. `.npmrc` selects pnpm's isolated linker so an undeclared dependency does not resolve through a sibling package. pnpm hard-links package files from its content-addressable store, so worktrees share bytes while `node_modules/.pnpm` stays inside the project root, which is what Turbopack requires. Never symlink one mutable `node_modules` into another checkout.

Verify dependency changes with a fresh clone. The live checkout's link graph can predate the change and hide a missing declaration that CI will catch.

## Services and ports

`.eph` declares services once. Every checkout gets a distinct container project, named volumes, and assigned host ports, and eph injects the resolved values as environment variables:

```sh
eph up          # start everything
eval "$(eph env)"
eph down        # stop what this session started
eph clean       # remove this worktree's service data
```

Services with `run=` must use `port=auto`; a Nudge rule rejects fixed ports. Tests that need a port bind to loopback port zero.

## Secrets

Secrets are committed as sops-encrypted files, so every worktree has them at checkout and an agent decrypts dev secrets with the user-wide `agent` key. Elevation to prod is a gitignored file inside one checkout (`.age/elevated`) and does not leak to siblings. See [Secrets](secrets.md).
