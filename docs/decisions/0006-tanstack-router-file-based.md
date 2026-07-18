# ADR 0006: TanStack Router in file-based mode routes the web app

Status: accepted

react-router is better known and has more training data, but its routes, params, and search parameters are strings the compiler cannot check. The template's premise is that agent-authored code needs the compiler rejecting plausible but invalid states, and navigation is a place agents routinely produce them.

TanStack Router makes links, params, and search parameters type-checked against the route tree, and file-based mode gives every page its own file: parallel agents add routes without touching a shared registry, and the generated route tree is an ordinary regenerated output.

Revisit if the project adopts server-side rendering (which reopens the framework question toward TanStack Start) or if route-tree generation fights the toolchain.
