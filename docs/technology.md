# Technology choices

This is the rationale behind the technology in this template: why these languages, these tools, this shape. It is not a tutorial. If you want to remove example capabilities and replace them with your own, the [customization guide](customizing.md) covers that.

## The breaking point

This template exists because a Rust project finally wore me down. I was running coding agents across several worktrees of the same repository, and each worktree accumulated dozens of gigabytes of `target` data. Merging three or four pull requests in quick succession, which is a completely ordinary task done several times a day now, turned six-minute CI checks into roughly an hour of serialized CI, merge, and rollout time. That was with a pipeline I had already spent real effort optimizing.

The frustrating part was that nothing was misconfigured. Every piece was behaving as designed. The design just assumed a world that no longer existed.

## What changed

Before coding agents, the cost of a full build was amortized across many human edits. I could make a dozen changes and run a single build to verify them all. The loop was slow, but I was slower, and I worked in one project for long stretches. Having multiple worktrees on different branches at once was rare.

In that world I worked predominantly in Rust, and it was the right call. The type system prevented entire classes of mistakes, and waiting for the compiler was cheap compared to the mistakes it caught.

Agents invert the arithmetic. I now work with agents nearly all the time, across multiple projects and multiple branches of each. Many branches are speculative and will be discarded; many will be rebased or merged into other branches; every one of them needs a fast feedback loop for the agent driving it to be useful. A slow feedback loop is no longer amortized; it is multiplied across every speculative branch.

Faster linkers, compiler caches, and build-profile tuning improve the constant factor without changing the shape of the problem. Agents still fan work out across divergent build graphs, discarded branches still consume compilation time, and accepted branches still converge through a merge queue that reruns checks after every rebase. Sharing mutable build output between worktrees just trades compilation time for lock contention and invalidation churn.

The conclusion was not that Rust's guarantees stopped mattering. Protection against invalid states matters even more when agents write the code, because agents produce plausible-looking wrong code at a rate humans never could. The conclusion was that paying Rust's full feedback cost on every product change no longer fit how the work happens. So the design goal of this template is a split: the common path (format, lint, typecheck, focused tests) stays cheap enough to run constantly, without invoking Cargo or starting the full service stack, while expensive checks remain authoritative at the narrow boundaries where their guarantees are worth the wait.

Every choice below is that one trade, applied somewhere specific.

## Bun and TypeScript for the high-churn path

Coding agents are unusually effective in TypeScript. The language has a huge body of training examples, expressive structural types, tagged unions, and fast tooling, so an agent gets useful compiler feedback without waiting for a native build. TypeScript 7 made this materially better by moving the compiler itself to a native Go implementation, and Oxlint and Oxfmt bring the same native speed to linting and formatting.

TypeScript was historically a poor fit for CLI work: it meant asking users to install Node, accepting awkward packaging and startup behavior, and living with module-resolution complexity. Bun changes that tradeoff. It bundles the runtime, application code, dependencies, assets, and native Node-API addons into a standalone executable, so a TypeScript CLI still ships as one download per platform.

There is a useful inversion hiding in that model. Bun's maintainers pay the expensive native compilation cost once, for the runtime. This repository consumes the runtime as a prebuilt artifact and compiles only product-level TypeScript in ordinary worktrees.

TypeScript is less sound than Rust, so the template compensates with a restricted dialect and layered checks: strict compiler options, type-aware linting, exhaustive state modeling, and rules against type-system escape hatches. External values stay `unknown` until a runtime decoder proves their shape at process, network, database, or native boundaries. The goal is a default path strongly typed enough that agents naturally produce acceptable code, not a pretense that TypeScript has become Rust.

## The alternatives that lost

Go was the first serious contender. It compiles quickly, runs faster than TypeScript, cross-compiles cleanly, and produces compact executables. But its type system is a poor fit for the closed workflow states and transitions that agents modify constantly. Without native closed variants and exhaustive matching, the repository would gradually grow a private type system out of generators, analyzers, marker interfaces, conventions, and tests, and the compiler would still understand fewer of the invariants. That trade can be fine for a small command runner or a network service where operational simplicity dominates. It is a bad default for agent-authored product code, where the compiler's main job is rejecting plausible but invalid states.

Zig moves the wrong direction on the same axis, since memory correctness leans more heavily on discipline, testing, and review. Haskell keeps sophisticated compile-time reasoning but also keeps substantial build graphs, so it does not solve the feedback-frequency problem. Dart, C# with NativeAOT, and OCaml are credible experiments, but their ecosystem, release, or model-fluency tradeoffs did not beat the TypeScript and Rust split.

## Rust where the guarantees earn their cost

Rust belongs where native integration, performance, or the type-level guarantees justify its slower feedback loop. The intention is that agents usually work in the TypeScript control plane, while Rust crates behave like versioned dependencies and change rarely. The guarantees are the critical part: Rust's type system is more sound than TypeScript's, so it also fits core business logic that must be ironclad even when performance doesn't demand it; putting core logic that rarely changes in Rust also helps keep the TypeScript code simpler and more focused on the high-churn path.

The example parser shows the shape. Domain logic lives in a pure Rust crate, and a thin Node-API adapter exposes a small interface to TypeScript. Calls across that boundary stay coarse-grained so native work dominates interop overhead. I chose Node-API over Bun's direct FFI because it is a more established production interface for Rust libraries to work with.

Mutable Cargo state stays local to each worktree. A completed native addon, though, is an immutable derived artifact, so worktrees with identical Rust inputs reuse a content-addressed build without sharing `target` directories. That yields the central performance property of the whole template: TypeScript-only work never compiles Rust.

## One monorepo, one worktree per agent

The Bun and Cargo workspaces live in one repository because a boundary change may need to touch TypeScript, Rust, schemas, tests, and packaging atomically. Splitting that across language-specific repositories would surface integration failures later and make each branch less coherent.

Each agent gets a complete Git worktree. Branch-sensitive state (dependency links, compiler output, databases, volumes, ports) stays isolated per worktree; immutable package contents and completed native artifacts may be shared. Fixed ports and a shared database are intolerable once several agents run full stacks concurrently, so eph declares the environment once and assigns each worktree its own PostgreSQL data and ports. An agent never has to coordinate port numbers, copy environment files, or invent Docker commands before it can test a branch.

## The smaller choices, same trade

The remaining decisions are smaller instances of the same question: where should a guarantee live, and how fast does its feedback arrive?

### Elysia and Eden

Elysia fits the Bun runtime and defines routes and runtime schemas in one place. The CLI talks to the server through Eden Treaty using the server's exported `App` type, so a change to a route, body, response, status, or parameter reaches every caller at typecheck speed. That source-level contract is appropriate exactly as long as the client and server are versioned together in one TypeScript monorepo; the compiled CLI still speaks HTTP and contains no server code, and OpenAPI remains a runtime documentation surface rather than a committed client-generation pipeline. A project that versions client and server independently, or adds a non-TypeScript consumer, should replace this with a language-neutral contract and an explicit compatibility policy.

### Incur

Incur defines CLI commands, options, environment variables, help, version handling, and structured agent-facing output from schemas. Executable packages stay thin: parse process inputs, construct dependencies, invoke libraries, render results. Application workflows remain dependency-injected, so they are testable at Bun test speed without spawning a process.

### Drizzle and PostgreSQL

PostgreSQL stands in for the stateful dependency most derived projects need. Drizzle keeps schema and query code typed while staying close to SQL, and the separate database library keeps route and command code from accumulating raw database access. Migrations are durable reviewed artifacts, and integration tests run against real PostgreSQL, because mocks cannot prove migration behavior, constraints, or database semantics. This is one of the boundaries where the expensive check is the authoritative one.

### Nudge and Bastion

Compiler and lint failures normally arrive after an agent has already written the code. Nudge moves mechanically decidable feedback into the edit itself, then repeats the same rules in CI; its rules cover unsafe TypeScript escapes, Rust `unwrap()`, and repository command requirements. A violation explains what matched and how to correct it so the agent can recover rather than just being rejected. Bastion handles what a deterministic rule cannot: it reviews semantic invariants after a coherent changeset exists. The template ships two general gates, correctness and simplicity, and the intended pattern is to add narrow single-concern reviewers for a project's own invariants, such as boundary validation, migration safety, or release coherence. Keeping deterministic checks in Nudge and judgment in Bastion makes failures faster and reviewer prompts more focused.

These two products work in concert with language-specific tools like clippy and oxlint to keep agent development mostly independent; the intention is that an agent can own a feature or a bugfix end to end with minimal human oversight while the automations do all the work of making sure things stay correct. The template's example rules are deliberately narrow and opinionated, so a derived project should replace them with its own rules and reviewers.

### Versions and releases

Git tags are the version source because a release already has a tag. The same resolved value reaches executables, packages, native code, API metadata, archives, and container labels, so there are no independent manifest versions to drift from the published artifact. The release pipeline is deliberately complete (binaries, installers, containers, SBOMs, provenance) because the starter demonstrates a distribution path. Keep it when it matches your product's distribution model; otherwise remove it.

## Applying these choices

The technology mix is a starting hypothesis. Preserve the fast Bun and TypeScript control plane and the agent-policy feedback loop, then keep each example capability only when its guarantees serve your project. The [customization guide](customizing.md) defines the supported capability boundaries and the checks required after each removal. [Architecture](architecture.md) documents the dependency direction and invariants that follow from these decisions, and the records in `docs/decisions` preserve narrower choices that a derived project may need to replace.
