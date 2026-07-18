# ADR 0005: Git tags are the only version source

Status: accepted

A release already has a Git tag, and every additional manifest version is an independent copy that can drift from the published artifact. Parallel agent branches make drift worse: version-bump commits conflict on every merge and invite automated fixes that disagree.

The authoritative version is the exact `vX.Y.Z` tag. The release workflow materializes it into package manifests, the lockfile, Cargo metadata, generated TypeScript, and build metadata; ordinary branches never commit version rewrites. Untagged checkouts resolve a `0.0.0+g<sha>` identity for diagnostics and native-cache keys, and it is never published.

Revisit if a registry or distribution channel requires committed manifest versions that cannot be rewritten at release time.
