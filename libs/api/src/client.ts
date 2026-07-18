import { treaty } from '@elysia/eden'
import type { Todo, TodoStatusFilter, UpdateTodoInput } from '@starter/domain'

import type { App } from './server.ts'

export type TodoDto = Todo
export type TodoStatus = TodoStatusFilter
export type UpdateTodoBody = UpdateTodoInput

export interface HealthDto {
  readonly status: 'ok'
  readonly version: string
}

export interface VersionDto {
  readonly version: string
  readonly tag: string | null
  readonly commit: string
  readonly nativeVersion: string
}

export class TodoApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(operation: string, status: number, detail: unknown) {
    super(`${operation} failed with HTTP ${status}: ${describeError(detail)}`)
    this.name = 'TodoApiError'
    this.status = status
    this.detail = detail
  }
}

function describeError(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message

  try {
    return JSON.stringify(value) ?? 'unknown error'
  } catch {
    return 'unserializable error'
  }
}

interface ApiResult<T> {
  readonly data: T | null
  readonly error: { readonly value: unknown } | null
  readonly status: number
}

function requireData<T>(operation: string, result: ApiResult<T>): T {
  if (result.error !== null) {
    throw new TodoApiError(operation, result.status, result.error.value)
  }
  if (result.data === null) {
    throw new TodoApiError(operation, result.status, 'response contained no data')
  }
  return result.data
}

export interface TodoApiClientOptions {
  readonly baseUrl: string
  readonly fetch?: typeof globalThis.fetch
}

export interface TodoApi {
  version(): Promise<VersionDto>
  list(status?: TodoStatus, limit?: number): Promise<readonly TodoDto[]>
  create(input: string): Promise<TodoDto>
  get(id: string): Promise<TodoDto>
  update(id: string, patch: UpdateTodoBody): Promise<TodoDto>
  delete(id: string): Promise<void>
}

function createEdenClient(options: TodoApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '')
  return treaty<App>(baseUrl, options.fetch === undefined ? {} : { fetcher: options.fetch })
}

export class TodoApiClient implements TodoApi {
  readonly #client: ReturnType<typeof createEdenClient>

  constructor(options: TodoApiClientOptions) {
    this.#client = createEdenClient(options)
  }

  async health(): Promise<HealthDto> {
    return requireData('health', await this.#client.api.health.get())
  }

  async version(): Promise<VersionDto> {
    return requireData('version', await this.#client.api.version.get())
  }

  async list(status: TodoStatus = 'open', limit = 50): Promise<readonly TodoDto[]> {
    const data = requireData(
      'list todos',
      await this.#client.api.v1.todos.get({ query: { status, limit } }),
    )
    return data.items
  }

  async create(input: string): Promise<TodoDto> {
    return requireData('create todo', await this.#client.api.v1.todos.post({ input }))
  }

  async get(id: string): Promise<TodoDto> {
    return requireData('get todo', await this.#client.api.v1.todos({ id }).get())
  }

  async update(id: string, patch: UpdateTodoBody): Promise<TodoDto> {
    return requireData('update todo', await this.#client.api.v1.todos({ id }).patch(patch))
  }

  async delete(id: string): Promise<void> {
    requireData('delete todo', await this.#client.api.v1.todos({ id }).delete())
  }
}
