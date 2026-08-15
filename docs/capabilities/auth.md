# Auth and billing

Clerk provides sign-in, sessions, organizations, machine tokens, and billing. The Next app uses Clerk's components and server helpers; the Hono API verifies bearer tokens with `@clerk/backend`; a Postgres `users` table mirrors what the app needs, kept current by webhooks.

Requires the [Web app](web-app.md) or the [API server](api-server.md), and [PostgreSQL](postgres.md) for the mirror table.

## Dependencies

| Package          | Version | Where                                                              |
| ---------------- | ------- | ------------------------------------------------------------------ |
| `@clerk/nextjs`  | 7.7.6   | `apps/web`                                                         |
| `@clerk/backend` | 3.16.6  | `libs/api` (comes with `@clerk/nextjs`; declare it where imported) |
| `@clerk/testing` | 2.2.24  | root dev, Playwright only                                          |

Do not use `@hono/clerk-auth`: it is deprecated toward `@clerk/hono`, which is pre-1.0 and has no Clerk documentation. Call `authenticateRequest()` from `@clerk/backend` directly; that is what Clerk documents for any non-Next server.

Clerk Core 3 (March 2026) removed `<Protect>`, `<SignedIn>`, and `<SignedOut>` in favor of `<Show when={...} fallback={...}>`, and renamed `@clerk/clerk-react` to `@clerk/react`. Tutorials older than that will not compile.

## Next app

- `apps/web/proxy.ts`: `export default clerkMiddleware()` from `@clerk/nextjs/server`, with the documented `config.matcher` (it includes `/__clerk/(.*)`), minus `/api/health`: add `api/health` to the negative lookahead of the first matcher and replace `/(api|trpc)(.*)` with `/api/((?!health).*)`. Every matched request talks to Clerk's frontend API on the handshake path, so when Clerk is unreachable (outage, wrong keys, no network) matched routes hang or 500; the health check must stay outside. Bearer auth for `/api/v1` is Hono's job anyway. Protect routes with `createRouteMatcher` and `auth.protect()` inside the middleware callback, or per page.
- Under `cacheComponents`, `auth()`, `<Show>`, and `<UserButton>` are request-bound: render them inside a `<Suspense>` boundary or the build fails on "uncached or runtime data during prerendering".
- `app/layout.tsx` wraps children in `<ClerkProvider>`.
- Server components and actions: `const { userId, orgId, has } = await auth()`; `auth()` is async. `currentUser()` for the profile.
- Sign-in and sign-up are Clerk-hosted or the `<SignIn />` / `<SignUp />` components under `app/sign-in/[[...sign-in]]/page.tsx`.
- Every server action and every repository call that touches tenant data receives `orgId` (or `userId` for B2C) from `auth()` and passes it down. Nothing reads Clerk inside `libs`.

## Hono API

Non-browser clients (CLI, services, agents) present `Authorization: Bearer <token>`. Middleware in `libs/api`:

```ts
const clerk = createClerkClient({ secretKey })
app.use('/api/*', async (c, next) => {
  const state = await clerk.authenticateRequest(c.req.raw, {
    acceptsToken: ['api_key', 'm2m_token', 'session_token'],
  })
  if (!state.isAuthenticated) return c.json({ code: 'unauthorized', message: 'Sign in' }, 401)
  const auth = state.toAuth()
  c.set(
    'principal',
    auth.tokenType === 'session_token'
      ? { userId: auth.userId, orgId: auth.orgId }
      : { subject: auth.subject, scopes: auth.scopes },
  )
  await next()
})
```

- `acceptsToken` defaults to `session_token`; machine tokens are rejected unless listed. Machine tokens expose `subject` and `scopes`, not `userId`.
- `verifyToken()` verifies session JWTs only; it is not the machine-auth entry point.
- API keys (GA, April 2026) are what a CLI or an external service uses; users create them in `<UserProfile />` or the app calls `clerkClient.apiKeys.create({ subject, scopes })`. M2M tokens (GA) are for service-to-service inside your own fleet. OAuth client-credentials is not supported; device flow is not documented. A CLI that wants interactive sign-in uses authorization code with PKCE and a loopback listener; simpler is to have the user paste an API key once and store it with `chmod 600`.
- Inject `principal` into `libs` calls; `libs` never imports Clerk.

## Users table and webhooks

Mirror only what the app queries: `users (id = clerk user id, email, name, image_url, created_at, updated_at)` and, for B2B, `organizations` and `memberships`. Everything else stays in Clerk.

`app/api/webhooks/clerk/route.ts` (a Next route handler, not the Hono app, so Clerk's `verifyWebhook` sees the raw request):

```ts
const event = await verifyWebhook(request)  // from '@clerk/nextjs/webhooks', reads CLERK_WEBHOOK_SIGNING_SECRET
switch (event.type) {
  case 'user.created': case 'user.updated': await users.upsert(...); break
  case 'user.deleted': await users.delete(event.data.id); break
}
return new Response(null, { status: 204 })
```

Non-2xx makes Svix retry. Handlers must be idempotent. Local development needs a tunnel; the integration test posts a signed sample payload instead.

## Billing

Clerk Billing (Stripe underneath, USD only, no tax, no usage metering yet, 0.7% on top of Stripe fees) covers plans, features, subscriptions, trials, per-seat, and organization billing. Self-hosting is not addressed in Clerk's docs; the only requirement is a public HTTPS webhook endpoint.

- Gate by feature, not plan: `const { has } = await auth(); if (!has({ feature: 'exports' })) ...`, and `<Show when={{ feature: 'exports' }}>` in components.
- `<PricingTable />` from `@clerk/nextjs` for the plans page; `for="organization"` in B2B.
- Entitlement state lives on subscription items; `subscription.created` fires when the user is created, not when they pay. Do not persist billing state; ask `has()` at request time. If a job needs it, the enqueuer checks and passes a boolean.
- Billing webhooks (`subscriptionItem.*`, `paymentAttempt.*`) arrive on the same route as user webhooks. Handle only what triggers work in your system.

## Tests

- Unit and component tests fake the auth boundary: `libs` receives a `principal`; server actions are tested through their `libs` calls. Clerk does not support unit tests.
- Playwright: `@clerk/testing/playwright` with `clerkSetup()` in global setup and `setupClerkTestingToken()` per test, using `+clerk_test` emails and OTP `424242`. Needs live dev-instance keys in CI secrets and network access; there is no offline Clerk. With dummy keys the smoke test cannot even load `/`: the middleware hangs on its handshake and protected routes redirect to an unresolvable `accounts.<domain>`. Put `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in CI secrets before adding this capability, or `test:e2e` fails from that commit on.

## Hubs

- `secrets/dev.env` and `secrets/prod.env`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`. `CLERK_TELEMETRY_DISABLED=1` is not secret; put it in `.eph` `[env]` and the container environment.
- `pnpm-workspace.yaml`: pnpm may add `minimumReleaseAgeExclude` entries for Clerk packages younger than its release-age policy; commit them knowingly.
- `env` module: the three keys, secret ones server-only.
- `AGENTS.md` invariants: "Auth is decided at the edge (proxy, server action, API middleware) and passed into `libs` as a principal. `libs` never imports Clerk. Gate by feature, never by plan name."
- `AGENTS.md` check classification: "Auth: run the API middleware tests and the webhook handler tests; run Playwright when sign-in flow changes."

## Bastion reviewer

Add commented out:

```yaml
reviewers:
  - name: auth-boundary
    trigger: ['apps/web/**', 'libs/**']
    mode: gate
    backend: codex
    prompt: |
      Review for authorization mistakes. Flag:
      1. A server action, route, or Hono handler that reads or writes
         tenant data without receiving orgId/userId (or a machine
         principal) from the auth layer and passing it to libs.
      2. Any import of @clerk/* inside libs other than the API middleware.
      3. A repository query on a tenant-scoped table with no tenant filter.
      4. A billing check on plan name instead of feature, or billing
         state persisted instead of asked via has().
      5. Use of <Protect>, <SignedIn>, <SignedOut>, or verifyToken for
         machine auth; these are removed or wrong in the current Clerk.
      Pass when none apply.
```
