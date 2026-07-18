import { QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Outlet,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { Suspense } from 'react'

import { TodoApiProvider } from '../api-context.tsx'
import type { WebRouterContext } from '../router.tsx'

export function PendingComponent() {
  return (
    <div aria-label="Loading page" className="space-y-3" role="status">
      {['first', 'second', 'third'].map((key) => (
        <div className="h-16 animate-pulse rounded-panel bg-soft" key={key} />
      ))}
    </div>
  )
}

function ErrorPanel({ error, reset }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : 'The page could not be loaded.'
  return (
    <section className="rounded-panel border border-error/30 bg-error-soft p-5" role="alert">
      <h2 className="font-semibold text-error">Something went wrong</h2>
      <p className="mt-1 text-sm leading-6 text-error">{message}</p>
      <button
        className="mt-4 rounded-control border border-error/40 px-4 py-2 text-sm font-semibold text-error active:translate-y-px"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </section>
  )
}

export function DefaultErrorComponent(props: ErrorComponentProps) {
  return <ErrorPanel {...props} />
}

function RouteErrorComponent(props: ErrorComponentProps) {
  return <ErrorPanel {...props} />
}

function RootLayout() {
  const { api, queryClient } = Route.useRouteContext()

  return (
    <TodoApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-[100dvh] bg-canvas px-4 py-10 text-ink sm:px-6 sm:py-16">
          <div className="mx-auto w-full max-w-3xl">
            <header className="max-w-xl">
              <h1 className="text-4xl leading-tight font-semibold tracking-[-0.04em] sm:text-5xl">
                Todos
              </h1>
              <p className="mt-3 max-w-lg text-base leading-7 text-muted">
                Add work in plain text, then track it through the todo API.
              </p>
            </header>
            <main className="mt-9">
              <Suspense fallback={<PendingComponent />}>
                <Outlet />
              </Suspense>
            </main>
          </div>
        </div>
      </QueryClientProvider>
    </TodoApiProvider>
  )
}

export const Route = createRootRouteWithContext<WebRouterContext>()({
  component: RootLayout,
  errorComponent: RouteErrorComponent,
  pendingComponent: PendingComponent,
})
