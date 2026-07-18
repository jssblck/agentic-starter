import { describe, expect, test } from 'bun:test'
import { TodoApiClient } from '@starter/api'
import { createApp } from '@starter/api/server'
import { createMemoryTodoRepository } from '@starter/db'
import type { TodoParser } from '@starter/native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { rtl, userEvent } from '../testing.ts'
import { TodoApiProvider } from '../api-context.tsx'
import { TodosPage } from './todos-page.tsx'

const { render, screen, waitFor } = rtl

const parser: TodoParser = {
  parse(input) {
    return {
      context: null,
      dueDate: null,
      priority: 'normal',
      tags: [],
      title: input,
    }
  },
  version() {
    return 'test'
  },
}

function createClient(): TodoApiClient {
  const app = createApp({ parser, todos: createMemoryTodoRepository() })
  const fetcher: typeof globalThis.fetch = Object.assign(
    (input: URL | RequestInfo, init?: RequestInit) => app.handle(new Request(input, init)),
    { preconnect: globalThis.fetch.preconnect },
  )
  return new TodoApiClient({ baseUrl: 'http://local.test', fetch: fetcher })
}

describe('TodosPage', () => {
  test('adds a todo through the real API handler', async () => {
    const api = createClient()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()
    const view = render(
      <TodoApiProvider api={api}>
        <QueryClientProvider client={queryClient}>
          <TodosPage />
        </QueryClientProvider>
      </TodoApiProvider>,
    )

    await screen.findByText('Your list is clear')
    await user.type(screen.getByLabelText('New todo'), 'Write component test')
    await user.click(screen.getByRole('button', { name: 'Add todo' }))

    const addButton = await screen.findByRole('button', { name: 'Add todo' })
    if (!(addButton instanceof HTMLButtonElement)) throw new Error('Add control is not a button')
    await waitFor(() => expect(addButton.disabled).toBe(false))
    expect(await screen.findByText('Write component test')).toBeDefined()
    expect((await api.list('all')).map((todo) => todo.title)).toContain('Write component test')

    view.unmount()
    queryClient.clear()
  })
})
