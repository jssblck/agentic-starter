import { describe, expect, test } from 'bun:test'
import { createMemoryTodoRepository } from '@starter/db'
import type { TodoParser } from '@starter/native'
import { VERSION } from '@starter/version'

import { TodoApiClient, TodoApiError } from './client.ts'
import { createApp } from './server.ts'

const parser: TodoParser = {
  parse(input) {
    return {
      title: input,
      tags: [],
      context: null,
      priority: 'normal',
      dueDate: null,
    }
  },
  version() {
    return VERSION
  },
}

function createClient(): TodoApiClient {
  const app = createApp({ todos: createMemoryTodoRepository(), parser })
  const fetcher: typeof globalThis.fetch = Object.assign(
    (input: URL | RequestInfo, init?: RequestInit) => app.handle(new Request(input, init)),
    { preconnect: globalThis.fetch.preconnect },
  )
  return new TodoApiClient({ baseUrl: 'http://local.test', fetch: fetcher })
}

describe('TodoApiClient', () => {
  test('uses the inferred Elysia contract over the fetch boundary', async () => {
    const client = createClient()
    const created = await client.create('Ship Eden client')

    expect((await client.list())[0]?.id).toBe(created.id)
    expect((await client.update(created.id, { completed: true })).completed).toBe(true)

    await client.delete(created.id)
    expect(client.get(created.id)).rejects.toBeInstanceOf(TodoApiError)
  })
})
