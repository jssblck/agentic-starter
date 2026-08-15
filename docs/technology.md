# Technology choices

This is the rationale behind the base: why these languages, tools, and shape. It is not a tutorial. `docs/capabilities` covers what a project can add on top.

## The breaking point

This template exists because a Rust project finally wore me down. I was running coding agents across several worktrees of the same repository, and each worktree accumulated dozens of gigabytes of `target` data. Merging three or four pull requests in quick succession, which is a completely ordinary task done several times a day now, turned six-minute CI checks into roughly an hour of serialized CI, merge, and rollout time. That was with a pipeline I had already spent real effort optimizing.

The frustrating part was that nothing was misconfigured. Every piece was behaving as designed. The design just assumed a world that no longer existed.

## What changed

Before coding agents, the cost of a full build was amortized across many human edits. I could make a dozen changes and run a single build to verify them all. The loop was slow, but I was slower, and I worked in one project for long stretches. Having multiple worktrees on different branches at once was rare.

In that world I worked predominantly in Rust, and it was the right call. The type system prevented entire classes of mistakes, and waiting for the compiler was cheap compared to the mistakes it caught.

Agents invert the arithmetic. I now work with agents nearly all the time, across multiple projects and multiple branches of each. Many branches are speculative and will be discarded; many will be rebased or merged into other branches; every one of them needs a fast feedback loop for the agent driving it to be useful. A slow feedback loop is no longer amortized; it is multiplied across every speculative branch.

Faster linkers, compiler caches, and build-profile tuning improve the constant factor without changing the shape of the problem. Agents still fan work out across divergent build graphs, discarded branches still consume compilation time, and accepted branches still converge through a merge queue that reruns checks after every rebase. Sharing mutable build output between worktrees just trades compilation time for lock contention and invalidation churn.

The conclusion was not that Rust's guarantees stopped mattering. Protection against invalid states matters even more when agents write the code, because agents produce plausible-looking wrong code at a rate humans never could. The conclusion was that paying Rust's full feedback cost on every product change no longer fit how the work happens. So the design goal is a split: the common path (format, lint, typecheck, focused tests) stays cheap enough to run constantly, while expensive checks remain authoritative at the narrow boundaries where their guarantees are worth the wait.

Every choice below is that one trade, applied somewhere specific.

## Bun and TypeScript for the high-churn path

Coding agents are unusually effective in TypeScript. The language has a huge body of training examples, expressive structural types, tagged unions, and fast tooling, so an agent gets useful compiler feedback without waiting for a native build. TypeScript 7 moved the compiler to a native Go implementation, and Oxlint and Oxfmt bring the same native speed to linting and formatting.

TypeScript was historically a poor fit for CLI work: it meant asking users to install Node, accepting awkward packaging and startup behavior, and living with module-resolution complexity. Bun changes that tradeoff. It bundles the runtime, application code, dependencies, assets, and native Node-API addons into a standalone executable, so a TypeScript CLI still ships as one download per platform.

There is a useful inversion hiding in that model. Bun's maintainers pay the expensive native compilation cost once, for the runtime. A derived project consumes the runtime as a prebuilt artifact and compiles only product-level TypeScript in ordinary worktrees.

TypeScript is less sound than Rust, so the base compensates with a restricted dialect and layered checks: strict compiler options, type-aware linting, exhaustive state modeling, and rules against type-system escape hatches. External values stay `unknown` until a runtime decoder proves their shape. The goal is a default path strongly typed enough that agents naturally produce acceptable code, not a pretense that TypeScript has become Rust.

## The alternatives that lost

Go was the first serious contender. It compiles quickly, runs faster than TypeScript, cross-compiles cleanly, and produces compact executables. But its type system is a poor fit for the closed workflow states and transitions that agents modify constantly. Without native closed variants and exhaustive matching, the repository would gradually grow a private type system out of generators, analyzers, marker interfaces, conventions, and tests, and the compiler would still understand fewer of the invariants. That trade can be fine for a small command runner or a network service where operational simplicity dominates. It is a bad default for agent-authored product code, where the compiler's main job is rejecting plausible but invalid states.

Zig moves the wrong direction on the same axis, since memory correctness leans more heavily on discipline, testing, and review. Haskell keeps sophisticated compile-time reasoning but also keeps substantial build graphs, so it does not solve the feedback-frequency problem. Dart, C# with NativeAOT, and OCaml are credible experiments, but their ecosystem, release, or model-fluency tradeoffs did not beat the TypeScript control plane.

## Rust where the guarantees earn their cost

Rust belongs where native integration, performance, or the type-level guarantees justify its slower feedback loop. The intention is that agents usually work in the TypeScript control plane, while Rust crates behave like versioned dependencies and change rarely. Rust's type system is more sound than TypeScript's, so it also fits core business logic that must be ironclad even when performance does not demand it, and it keeps the TypeScript code focused on the high-churn path.

The base ships no Rust. `docs/capabilities/rust-native.md` describes the shape when a project needs it: a pure crate, a thin Node-API adapter, coarse calls, and a content-addressed cache of built addons so worktrees with identical Rust inputs never rebuild.

## One monorepo, one worktree per agent

A Bun workspace lives in one repository because a boundary change may need to touch several packages, schemas, tests, and packaging atomically. Splitting that across repositories surfaces integration failures later and makes each branch less coherent.

Each agent gets a complete Git worktree. Branch-sensitive state (dependency links, compiler output, databases, volumes, ports) stays isolated per worktree; immutable package contents may be shared. Fixed ports and a shared database are intolerable once several agents run full stacks concurrently, so eph declares the environment once and assigns each worktree its own data and ports. An agent never has to coordinate port numbers, copy environment files, or invent Docker commands before it can test a branch.

## Nudge and Bastion

Compiler and lint failures normally arrive after an agent has already written the code. Nudge moves mechanically decidable feedback into the edit itself, then repeats the same rules in CI. A violation explains what matched and how to correct it so the agent can recover rather than just being rejected. Bastion handles what a deterministic rule cannot: it reviews semantic invariants after a coherent changeset exists. The base ships Nudge rules against type-system escape hatches, fixed ports, and the wrong package manager, and a Bastion registry with no active reviewers and two suggested defaults in comments. Keeping deterministic checks in Nudge and judgment in Bastion makes failures faster and reviewer prompts more focused.

The intention is that an agent can own a feature or a bugfix end to end with minimal human oversight while the automations do the work of keeping things correct.

## Capabilities as prose

Earlier versions of this template shipped a full example application: HTTP API, CLI, PostgreSQL, web UI, Rust parser, and a release pipeline. Deriving a project meant deleting most of it, and deletion across forty shared files is the kind of surgery agents get wrong. The example is gone. What remains of it is one guide per capability under `docs/capabilities`, written from the working code at the moment it was removed, plus the `bootstrap` skill that interviews the user and applies the chosen guides. Adding is easier for an agent than deleting, and an agent can read a guide where it cannot read a generator's templates. Nothing verifies a guide after the code is gone except the next agent that follows it, so a guide that proves wrong is fixed in the same commit as the code.
