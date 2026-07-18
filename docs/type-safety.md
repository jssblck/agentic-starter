# Type safety

## Layers have different jobs

TypeScript, Oxlint, Nudge, boundary decoders, and Bastion overlap deliberately, but they do not replace one another.

### TypeScript

`tsconfig.json` makes missing values and unchecked indexing visible. Exact optional properties distinguish “absent” from “present with undefined.” Unknown catch variables keep errors untrusted until inspected.

### Oxlint

Oxlint runs type-aware rules for unsafe assignment, calls, arguments, member access, and returns. It also requires handled promises and exhaustive switches. Oxfmt is the only formatter.

### Nudge

Nudge blocks local deterministic violations at write time and repeats file-based rules with `nudge check` in CI. The current rules reject explicit `any`, non-null assertions, checker suppression comments, double casts, and Rust `unwrap()`.

A Nudge rule should be mechanically true or false. Do not use it for architectural judgment.

### Runtime decoders

Static types cannot prove external bytes. Decode environment variables, JSON, database-adjacent dynamic data, HTTP API error responses, and native output before creating domain values.

`libs/native/src/decode.ts` shows the intended pattern:

1. receive `unknown`;
2. prove object shape;
3. read each field with a narrow helper;
4. verify closed union values;
5. construct the trusted type.

Keep unsafe library interop in a named boundary file and make the resulting interface smaller than the library surface.

### Bastion

Bastion reviewers evaluate semantic questions that a syntax rule cannot answer: whether a decoder exists at the right boundary, whether a migration rollout is safe, whether OpenAPI behavior remains compatible, and whether a native cache key can reuse an incompatible artifact.

## Preferred modeling patterns

Use tagged unions for lifecycle states and exhaustive switches. Use branded or wrapped identifiers when two strings have different meanings. Prefer constructors that make invalid values unrepresentable. Keep raw optional values at the edge and normalize them before domain logic.

Avoid types that merely describe the happy path while runtime code admits more states.
