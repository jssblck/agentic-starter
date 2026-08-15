---
name: bootstrap
description: Turn the Agentic Starter base into a real project. Interview the user about the product, identity, surfaces, persistence, native code, and distribution, then apply the matching capability guides in dependency order. Use on a fresh clone of the starter, or when a derived project adds a capability later.
---

# Bootstrap a project

The base ships policy, checks, and worktree isolation with no application code. This skill fills it in. Read `docs/architecture.md` first, then `docs/capabilities/README.md`.

## 1. Interview

Ask these in order. Skip any the user already answered. Ask one question at a time and record the answers; the summary in step 2 depends on them.

1. **Product.** What does the project do, in one or two sentences? Who calls it: people, other services, agents?
2. **Identity.** Display name, repository owner and name, package scope (`@scope/`), executable names, environment variable prefix. Derive unstated values from the display name and confirm them.
3. **Surfaces.** Which of: HTTP API, CLI, web UI, none (library only)? A web UI needs the HTTP API. A CLI usually talks to the API but can stand alone.
4. **Persistence.** PostgreSQL, or none for now? Anything else (Redis, object storage) is an eph service the user describes; there is no guide for it yet.
5. **Native code.** Is there a hot path or a correctness core that justifies Rust behind Node-API? Default no. Say why it costs: every worktree pays for the toolchain, and CI gains a job.
6. **Distribution.** Source only, CLI binaries with installers, container image, or several? Default source only.
7. **Review gate.** Enable the suggested Bastion reviewers now, later, or never? Each is a paid agent run per changeset. Default later.
8. **Repository administration.** GitHub org or team for `CODEOWNERS`, security contact, license holder name.

## 2. Confirm the plan

Summarize: identity table, chosen capabilities in the order from `docs/capabilities/README.md`, what stays out, and the resulting `check` and `ci` steps. Ask for a yes before touching files.

## 3. Apply identity

Trace the current identity by role, not by string:

- root `package.json` name and description; workspace scope in new packages
- `.codex/environments/environment.toml` name
- `NOTICE`, `SECURITY.md`, `LICENSE` holder, `README.md` first heading and paragraph
- `.github/CODEOWNERS` teams
- environment prefix in `.eph` `[env]` and any `.env.example`
- the migration lock name and cache namespace when those capabilities are added

Do not run a repository-wide search-and-replace. The forms differ (`todoctl`, `TODO_API_URL`, `@starter/`, "Agentic Starter").

## 4. Apply capabilities

For each chosen capability, follow its guide in `docs/capabilities/` completely: packages, pinned dependencies (confirm each against the registry; the guides record the last known-good set), hub edits, invariants appended to `AGENTS.md`, Nudge rules with fixtures registered in `tools/check-nudge-rules.ts`, `check` and `ci` steps, `tools/doctor.ts` probes.

Keep the vertical slice compiling after each capability: run `bun install`, then `bun install --frozen-lockfile`, then `bun run check`. Fix before moving on.

Domain code goes in `libs`; entrypoints stay thin in `apps`. New behavior lands in its own file, and shared hubs grow by one line (`one-feature-one-file`, `mergeable-edits`).

## 5. Finish

1. Rewrite `docs/architecture.md`: dependency diagram for the chosen packages and the invariants that apply. Delete the base's placeholder text.
2. Update `AGENTS.md` check classification to list only the capabilities present.
3. Update `README.md` for the project. Delete this skill's mention from it once the project is bootstrapped, or keep it if the user expects to add capabilities later.
4. Run `bun run ci`. Verify with a fresh clone (`git clone` to a scratch directory, `bun install --frozen-lockfile`, `bun run check`); the working checkout's link graph can hide undeclared dependencies.
5. Commit in slices: identity, then one commit per capability.

## Guardrails

- Do not add a capability the user did not choose because it "would be needed anyway."
- Do not weaken a Nudge rule, tsconfig option, or lint rule to make an add-on compile. Report the conflict.
- Do not fix a wrong guide silently. Correct the guide in the same commit as the code and say so.
- Do not create the first release tag. Leave that to the user after they verify installer URLs and registry permissions.
