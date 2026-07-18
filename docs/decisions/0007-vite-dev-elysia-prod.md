# ADR 0007: Vite serves development, the server serves production

Status: accepted

UI hot reload and API hot reload have different owners. In development Vite owns the browser connection with hot module replacement and React Fast Refresh, proxying `/api` to the eph-assigned server port, while the API reloads separately under `bun --hot`. Neither loop restarts the other.

In production the Elysia server serves the compiled assets same-origin behind the `/api` prefix: one process, no CORS, no configured API URL in the browser, and an `index.html` fallback for client routes that never captures `/api`.

Bun's fullstack dev server could replace Vite and drop a dependency. Revisit when its plugin ecosystem covers route-tree generation and Tailwind as well as Vite's does; the choice is invisible to the shipped artifact.
