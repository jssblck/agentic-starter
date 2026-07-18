# Agent workflow

## Before editing

Read `AGENTS.md`, classify the change, and open the narrowest relevant document. Start dependency services with eph only when the task needs them.

## During editing

Nudge should catch mechanical policy violations immediately. Keep the fast loop focused:

- TypeScript product change: typecheck and focused tests.
- Rust parser change: parser crate only.
- Boundary change: materialize native addon and run integration tests.
- API change: update the Elysia schemas and Eden client facade, then run the API tests and TypeScript checks.
- schema change: generate and inspect SQL.

Do not run the full repository check after every small edit. Run it when the changeset is coherent.

## Before review

```sh
bun run check
bastion review --base main
```

Bastion reviewers are deliberately single-concern. Address blocking findings in their scope. When a reviewer drifts into style or unrelated design, refine its prompt rather than accumulating exceptions in application code.

## Durable learning

Use Nudge's learned repository memory for concrete debugging facts that are likely to recur. Good entries state the symptom, root cause, fix, and verification. Do not store generic language advice or temporary task state.
