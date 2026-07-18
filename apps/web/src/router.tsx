import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import type { TodoApi } from '@starter/api'

import { routeTree } from './routeTree.gen.ts'
import { DefaultErrorComponent, PendingComponent } from './routes/__root.tsx'

export interface WebRouterContext {
  readonly api: TodoApi
  readonly queryClient: QueryClient
}

export function createWebQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
      },
    },
  })
}

export function createWebRouter(context: WebRouterContext) {
  return createRouter({
    context,
    defaultErrorComponent: DefaultErrorComponent,
    defaultPendingComponent: PendingComponent,
    defaultPreload: 'intent',
    routeTree,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createWebRouter>
  }
}
