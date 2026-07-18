# ADR 0008: Base UI provides headless primitives

Status: accepted

This repository does not vendor component code, so the copy-paste kits built on Radix are out of scope and the choice is between primitive libraries as ordinary dependencies.

Base UI is the actively developed successor to Radix from the same lineage plus the MUI and Floating UI teams, with cleaner composition (render props over `asChild`). Radix's advantages are familiarity and training-data volume, which are wasting assets while its primitives sit in low-activity maintenance. Agents will occasionally write Radix idioms from memory; the compiler catches them at import time.

Revisit if Base UI development stalls or the project changes its stance on vendored components.
