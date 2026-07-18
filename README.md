# Agentic Starter

This repository is a template for starting software projects that several coding agents will develop in parallel Git worktrees. Its job is to give a new project a fast, strict Bun and TypeScript foundation, an isolated development environment, and an agent policy layer from the first commit.

The todo application is disposable example code. Rust, PostgreSQL, the HTTP server, the CLI, native bindings, and the release pipeline are present to demonstrate complete capability units that can be renamed, replaced, or deleted. Do not preserve them unless the new project needs them.

## Start a new project

Create a new repository from this template, clone it, and install the locked dependencies:

```sh
bun install --frozen-lockfile
bun run doctor
```

Then ask a coding agent to use the checked-in `customize-starter` skill. Give it the new project's identity and the capabilities you intend to keep:

```text
Use the customize-starter skill to turn this template into my new project.

Display name: <human-readable product name>
Repository: <owner/repository>
Repository URL: <canonical Git URL>
Package scope: <npm package scope>
CLI name: <command name, or remove the CLI>
Server name: <service name, or remove the server>
Environment prefix: <uppercase prefix>
Description: <one-sentence project description>

Keep: <capability units the project needs>
Remove: <capability units the project does not need>
```

The skill traces each identity through its actual consumers. Package scopes, binary names, environment variables, artifact names, container paths, cache namespaces, URLs, and prose have different grammatical forms, so a repository-wide search and replace is not a safe customization method.

## Choose the starting shape

Bun, TypeScript, the root `bun run check` command, and the agent policy layer are the permanent base. Everything else is an example capability:

- Rust and native code
- PostgreSQL persistence
- HTTP API
- React web UI
- CLI distribution
- containers and releases
- shared build identity
- worktree-local services

Keep only what the derived project needs. Delete an unused capability as a complete unit, including its code, tests, workflows, configuration, reviewers, dependencies, and documentation. [The customization guide](docs/customizing.md) maps each capability to the files and shared hubs that must change together.

If the project keeps the example stack temporarily, replace the todo vertical slice in the order documented by the customization guide. This keeps the repository compiling while domain types, native boundaries, persistence, API routes, and commands change together.

## Review the project-specific decisions

The agent can update names and code, but it cannot infer ownership or publishing policy. Before treating the result as the new project's baseline, review:

- `.github/CODEOWNERS` and repository ownership
- Bastion authentication and branch protection
- license, security contacts, and package visibility
- container registry and deployment permissions
- installer defaults and release artifact names

Do not publish the first tag until installer URLs, image permissions, and native release targets have been verified in the derived repository.

## Prove the clean baseline

After customization, update and verify the dependency graph:

```sh
bun install
bun install --frozen-lockfile
```

Run `cargo check --workspace --locked` if Rust remains. Run `bun run native:ensure` only if the native boundary remains and needs an integration test or executable. Then run the repository gates:

```sh
bun run check
bastion review --base main
```

Finally, search for the old display name, repository slug, package scope, binary names, environment prefix, URLs, and names owned by deleted capabilities. A customized repository should describe only the derived project; this starter's identity and example domain should be gone.

## Reference documents

Permanent base, kept by every derived project:

- [Customizing the starter](docs/customizing.md) is the authoritative capability and verification guide.
- [Technology choices](docs/technology.md) explains why the template uses its current stack and which assumptions should trigger a different choice.
- [Architecture](docs/architecture.md) defines the permanent base and dependency boundaries.
- [Worktrees](docs/worktrees.md) covers per-agent isolation of checkouts, services, and build state.
- [Type safety](docs/type-safety.md) explains the layered checks and preferred modeling patterns.

Example-capability documentation, removed or rewritten together with its capability:

- [Getting started](docs/getting-started.md) installs the toolchain and runs the full example stack.
- [Database and migrations](docs/database.md) covers the PostgreSQL persistence capability.
- [HTTP API](docs/http-api.md) covers the Elysia and Eden contract.
- [Web UI](docs/web-ui.md) covers the React app, its state rules, and its testing pattern.
- [Versioning and releases](docs/versioning-and-releases.md) covers the release pipeline.

Decision records in `docs/decisions` preserve narrower choices that a derived project may need to replace.
