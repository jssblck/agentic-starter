# Contributing

Read `AGENTS.md` and `docs/architecture.md` before changing dependency boundaries.

Use a Git worktree for each branch, run the check set appropriate to the change class, and regenerate committed artifacts from their source. Pull requests that modify database schema, OpenAPI, native interfaces, policy files, or release workflows should explain the rollout or compatibility effect.

Before requesting review:

```sh
bun run check
bastion review --base main
```

Do not commit generated release-version rewrites from an ordinary branch. Do commit dependency lockfiles, SQL migrations, OpenAPI JSON, and generated API types.
