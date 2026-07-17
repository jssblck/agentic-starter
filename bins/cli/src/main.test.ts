import { describe, expect, test } from 'bun:test'
import type { TodoApi } from '@starter/api'
import type { Todo, TodoStatusFilter, UpdateTodoInput } from '@starter/domain'
import type { TodoParser } from '@starter/native'

import { createTodoCli } from './cli.ts'

const todo: Todo = {
  id: 'd46d6f9f-61c6-4410-9ead-93dfa270f63f',
  input: 'Read architecture docs @office #onboarding',
  title: 'Read architecture docs',
  tags: ['onboarding'],
  context: 'office',
  priority: 'normal',
  dueDate: null,
  completed: false,
  completedAt: null,
  createdAt: '2026-07-17T00:00:00.000Z',
  updatedAt: '2026-07-17T00:00:00.000Z',
}

class InMemoryTodoApi implements TodoApi {
  lastList: { readonly status: TodoStatusFilter; readonly limit: number } | null = null

  async version() {
    return { version: '1.0.0', tag: 'v1.0.0', commit: 'abc123', nativeVersion: '1.0.0' }
  }

  async list(status: TodoStatusFilter = 'open', limit = 50) {
    this.lastList = { status, limit }
    return [todo]
  }

  async create() {
    return todo
  }

  async get() {
    return todo
  }

  async update(_id: string, _patch: UpdateTodoInput) {
    return todo
  }

  async delete() {}
}

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
    return '1.0.0'
  },
}

async function serve(
  argv: string[],
  env: Record<string, string | undefined> = {},
): Promise<{
  readonly api: InMemoryTodoApi
  readonly exitCode: number
  readonly output: string
  readonly startedServer: { readonly hostname: string; readonly port: number } | null
}> {
  const api = new InMemoryTodoApi()
  let output = ''
  let exitCode = 0
  let startedServer: { readonly hostname: string; readonly port: number } | null = null
  const cli = createTodoCli({
    createApi: () => api,
    createParser: () => parser,
    startHttpServer(options) {
      startedServer = { hostname: options.hostname, port: options.port }
      return { url: new URL('http://127.0.0.1:41234') }
    },
  })

  await cli.serve(argv, {
    env,
    stdout(value) {
      output += value
    },
    exit(code) {
      exitCode = code
    },
  })

  return { api, exitCode, output, startedServer }
}

describe('todoctl', () => {
  test('provides generated help and version output', async () => {
    const help = await serve(['--help'])
    const version = await serve(['--version'])

    expect(help.output).toContain('Usage: todoctl <command>')
    expect(help.output).toContain('--format')
    expect(help.output).toContain('--mcp')
    expect(version.output.trim()).toMatch(/^0\.0\.0/)
  })

  test('parses list options with Incur', async () => {
    const result = await serve(['list', '--status', 'completed', '--limit', '12', '--json'])

    expect(result.exitCode).toBe(0)
    expect(result.api.lastList).toEqual({ status: 'completed', limit: 12 })
    expect(JSON.parse(result.output)).toEqual({ items: [todo] })
  })

  test('passes only TODO text to the native parser', async () => {
    const result = await serve(['add', 'Buy oat milk', '--dry-run', '--json'])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.output)).toEqual({
      title: 'Buy oat milk',
      tags: [],
      context: null,
      priority: 'normal',
      dueDate: null,
    })
  })

  test('preserves literal percent encoding outside HTTP paths', async () => {
    const result = await serve(['parse', 'Keep %20 literal', '--json'])

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('"title": "Keep %20 literal"')
  })

  test('starts Incur HTTP only through the explicit serve command', async () => {
    const result = await serve(['serve', '--host', '127.0.0.1', '--port', '0', '--json'])

    expect(result.exitCode).toBe(0)
    expect(result.startedServer).toEqual({ hostname: '127.0.0.1', port: 0 })
    expect(JSON.parse(result.output)).toEqual({ url: 'http://127.0.0.1:41234/' })
  })

  test('uses PORT for the Incur HTTP listener', async () => {
    const result = await serve(['serve', '--json'], { PORT: '43123' })

    expect(result.exitCode).toBe(0)
    expect(result.startedServer).toEqual({ hostname: '127.0.0.1', port: 43_123 })
  })

  test('exposes the todoctl command catalog over MCP HTTP', async () => {
    const cli = createTodoCli({
      createApi: () => new InMemoryTodoApi(),
      createParser: () => parser,
      startHttpServer() {
        return { url: new URL('http://127.0.0.1:41234') }
      },
    })
    const response = await cli.fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'Ada', version: '1.0.0' },
          },
        }),
      }),
    )
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('"name":"todoctl"')
    expect(body).toContain('"tools"')
  })

  test('decodes TODO text from Incur HTTP path segments', async () => {
    const cli = createTodoCli({
      createApi: () => new InMemoryTodoApi(),
      createParser: () => parser,
      startHttpServer() {
        return { url: new URL('http://127.0.0.1:41234') }
      },
    })
    const response = await cli.fetch(new Request('http://localhost/parse/Buy%20oat%20milk'))
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('"title":"Buy oat milk"')
  })
})
