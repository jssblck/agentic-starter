---
name: bootstrap
description: Turn the Agentic Starter base into a real project. Interview the user about the product, identity, surfaces, persistence, jobs, auth, observability, native code, and distribution, then apply the matching capability guides in dependency order. Use on a fresh clone of the starter, or when a derived project adds a capability later.
---

# Bootstrap a project

The base ships policy, checks, and worktree isolation with no application code. This skill fills it in. Read `docs/architecture.md` first, then `docs/capabilities/README.md`.

## 1. Interview

Ask these in order. Skip any the user already answered. Ask one question at a time and record the answers; the summary in step 2 depends on them.

1. **Product.** What does the project do, in one or two sentences? Who calls it: people, other services, agents?
2. **Identity.** Display name, repository owner and name, package scope (`@scope/`), executable names, environment variable prefix. Derive unstated values from the display name and confirm them.
3. **Clients.** Who calls the backend: only a browser, or also a CLI, a mobile app, other services, or agents over MCP? Browser only: the Next.js `web-app` alone. Browser plus others: `web-app` with `api-server` mounted inside it; the browser uses server actions, everyone else uses `/api`. No browser: `api-server` standalone.
4. **Surfaces.** Given the answer above: web UI, CLI, both, or neither (library only)?
5. **Persistence.** PostgreSQL, or none for now? Postgres also carries the job queue, caches, rate limits, and realtime notifications; do not offer Redis unless the user names a need Postgres cannot meet. Object storage is an eph service the user describes; there is no guide for it yet.
6. **Background jobs.** Does anything run outside a request (scheduled work, retries, slow tasks)? Default yes when Postgres is present: the `worker` guide. Requires Postgres.
7. **Auth and billing.** Do people sign in? Do they pay? Default Clerk for both when a browser exists (`auth` guide); machine tokens for API-only products. None for a library or an internal tool.
8. **Observability.** Where do logs, traces, and errors go? Default the `observability` guide (LogTape to the console in development, OpenTelemetry and Sentry in production) whenever there is a server process; ask for the OTLP endpoint and Sentry DSN only if the user has them now.
9. **Native code.** Is there a hot path or a correctness core that justifies Rust behind Node-API? Default no. Say why it costs: every worktree pays for the toolchain, and CI gains a job.
10. **Distribution.** Source only, CLI binaries with installers, container image, or several? Default source only.
11. **Review gate.** Enable the suggested Bastion reviewers now, later, or never? Each is a paid agent run per changeset. Default later.
12. **Repository administration.** GitHub org or team for `CODEOWNERS`, security contact, license holder name.

## 2. Confirm the plan

Summarize: identity table, chosen capabilities in the order from `docs/capabilities/README.md`, what stays out, and the resulting `check` and `ci` steps. Ask for a yes before touching files.

## 3. Apply identity

Trace the current identity by role, not by string:

- root `package.json` name and description; workspace scope in new packages
- `.codex/environments/environment.toml` name
- `NOTICE`, `SECURITY.md`, `LICENSE` holder, `README.md` first heading and paragraph
- `.github/CODEOWNERS` teams
- environment prefix in `.eph` `[env]`
- `.sops.yaml` recipients: replace the placeholder public keys with the user's `personal`, `agent`, and `prod` keys, then `pnpm secrets init dev` and `pnpm secrets init prod` (see `docs/secrets.md`)
- the migration lock name and cache namespace when those capabilities are added

Do not run a repository-wide search-and-replace. The forms differ (`todoctl`, `TODO_API_URL`, `@starter/`, "Agentic Starter").

## 4. Apply capabilities

Apply `docs/capabilities/env.md` with the first surface; it is not optional. Then, for each chosen capability, follow its guide in `docs/capabilities/` completely: packages, pinned dependencies (confirm each against the registry; the guides record the last known-good set), hub edits, invariants appended to `AGENTS.md`, Nudge rules with fixtures registered in `tools/check-nudge-rules.ts`, `check` and `ci` steps, `tools/doctor.ts` probes.

Keep the vertical slice compiling after each capability: run `pnpm install`, then `pnpm install --frozen-lockfile`, then `pnpm run check`. Fix before moving on.

Domain code goes in `libs`; entrypoints stay thin in `apps`. New behavior lands in its own file, and shared hubs grow by one line (`one-feature-one-file`, `mergeable-edits`).

## 5. Finish

1. Rewrite `docs/architecture.md`: dependency diagram for the chosen packages and the invariants that apply. Delete the base's placeholder text.
2. Update `AGENTS.md` check classification to list only the capabilities present.
3. Update `README.md` for the project. Delete this skill's mention from it once the project is bootstrapped, or keep it if the user expects to add capabilities later.
4. Run `pnpm run ci`. Verify with a fresh clone (`git clone` to a scratch directory, `pnpm install --frozen-lockfile`, `pnpm run check`); the working checkout's link graph can hide undeclared dependencies.
5. Commit in slices: identity, then one commit per capability.

## Guardrails

- Do not add a capability the user did not choose because it "would be needed anyway."
- Do not weaken a Nudge rule, tsconfig option, or lint rule to make an add-on compile. Report the conflict.
- Do not fix a wrong guide silently. Correct the guide in the same commit as the code and say so.
- Do not create the first release tag. Leave that to the user after they verify installer URLs and registry permissions.
