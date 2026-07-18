---
name: decision-records
description: Record, supersede, or consult architecture decision records in docs/decisions. Use when a changeset settles a non-trivial design choice, when deciding whether an existing choice is intentional, or when changing a decision a record already covers.
---

# Decision records

`docs/decisions` is the log of intentional non-trivial choices. It exists so settled decisions are not relitigated and so intent is distinguishable from accident. The repository relies on the inverse inference: a choice with no decision record is incidental and may be changed on its merits, while a choice with a record must not be reversed without superseding it.

## When to write one

The test is reversal harm: would a maintainer object if a later agent silently reversed the choice? If either outcome is acceptable, do not write a record; letting trivial decisions be relitigated is cheaper than logging them. Record only choices that pass this test, in the same changeset that makes them: an obvious alternative was rejected, a constraint spans packages, or the tradeoff is invisible in the code.

Most changesets, including large ones, add no record. Every record is a standing constraint that later requires human approval to lift, so an unnecessary record is process debt, not thoroughness.

Do not write one for conventional choices, for rules Nudge already enforces mechanically, or for debugging lessons (`nudge learn add` covers those). If the rationale fits at the point of use, a code comment is enough.

## Format

Create `docs/decisions/NNNN-short-slug.md` with the next unused number:

```markdown
# ADR NNNN: <the decision, stated as a fact>

Status: accepted

<Context: the forces that made this a real decision.>

<The decision and its mechanism.>

<Consequences, including what would trigger revisiting it.>
```

One record per decision. Keep it under a page; ADR 0001 through 0003 set the expected length and tone.

## Changing a decision

Superseding, reversing, or editing an existing record requires explicit human direction. Draft the superseding record and present it, but do not proceed with work that depends on the reversal until a human approves.

Records are append-only. To change a decision, write a new record and update the old one to `Status: superseded by ADR NNNN` without editing its substance. The one exception is a record that never matched the repository: correct or replace it in place and say so in the commit message.

## Consulting records

Before reversing an existing design choice, check `docs/decisions` for a record covering it. If one exists, follow it or supersede it explicitly; do not silently diverge.
