import { describe, expect, test } from 'bun:test'
import { createMemoryTodoRepository } from '@starter/db'
import type { TodoParser } from '@starter/native'
import { VERSION } from '@starter/version'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

describe('todo API', () => {
  test('serves the API and OpenAPI surface only under the API prefix', async () => {
    const app = createApp({ todos: createMemoryTodoRepository(), parser })

    expect((await app.handle(new Request('http://local.test/api/health'))).status).toBe(200)
    expect((await app.handle(new Request('http://local.test/api/openapi'))).status).toBe(200)
    expect((await app.handle(new Request('http://local.test/health'))).status).toBe(404)
  })

  test('creates and lists a todo through real Elysia request handling', async () => {
    const app = createApp({ todos: createMemoryTodoRepository(), parser })
    const createResponse = await app.handle(
      new Request('http://local.test/api/v1/todos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'Write tests' }),
      }),
    )
    expect(createResponse.status).toBe(201)

    const createBody: unknown = JSON.parse(await createResponse.text())
    expect(isRecord(createBody) && createBody['title']).toBe('Write tests')

    const listResponse = await app.handle(new Request('http://local.test/api/v1/todos?status=open'))
    expect(listResponse.status).toBe(200)
    const listBody: unknown = JSON.parse(await listResponse.text())
    expect(isRecord(listBody) && Array.isArray(listBody['items'])).toBe(true)
  })

  test('returns a typed client error when native parsing fails', async () => {
    const failingParser: TodoParser = {
      parse() {
        throw new Error('invalid parser syntax')
      },
      version() {
        return VERSION
      },
    }
    const app = createApp({ todos: createMemoryTodoRepository(), parser: failingParser })
    const response = await app.handle(
      new Request('http://local.test/api/v1/todos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'broken' }),
      }),
    )
    expect(response.status).toBe(400)
    expect(await response.text()).toContain('invalid parser syntax')
  })
})
