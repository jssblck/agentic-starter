# Worktrees

## One checkout per agent

```sh
git worktree add ../worktrees/agent-42 -b agent/42 main
```

A change that spans several packages belongs in one worktree and one commit series. Splitting it across worktrees makes interface changes non-atomic and moves integration failures later.

## What the hooks do

Claude Code's `SessionStart` hook and Codex's setup script run the same three steps: fetch `origin/main`, `bun install --frozen-lockfile`, `eph up`. They stop when any step fails. They do not rebase the branch; look at the branch, then decide.

Both tools copy the ignored files listed in `.worktreeinclude` (`.env`) into a new worktree. Neither copies `node_modules`.

`WorktreeRemove` and Codex cleanup run `eph clean`, which removes the worktree's containers, volumes, and saved eph state.

## Bun state

Each checkout has its own `node_modules` link graph. `bunfig.toml` selects the isolated linker so an undeclared dependency does not resolve through a sibling package, and hard-links package files from Bun's install cache so worktrees share bytes. Do not enable `globalStore`: it replaces the hard links with symlinks into `~/.bun`, which Turbopack rejects as outside the project root. Never symlink one mutable `node_modules` into another checkout.

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

A linked worktree does not inherit ignored files from another checkout unless `.worktreeinclude` lists them. Prefer eph-resolved values and a user-level secret manager. When a worktree needs a local secret file, have setup create or link it explicitly.
