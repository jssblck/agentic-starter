import { openapi } from '@elysia/openapi'
import type { TodoRepository } from '@starter/db'
import type { UpdateTodoInput } from '@starter/domain'
import type { TodoParser } from '@starter/native'
import { VERSION, versionPayload } from '@starter/version'
import { Elysia, t } from 'elysia'

const NullableString = t.Union([t.String(), t.Null()])
const TodoPriority = t.Union(
  [t.Literal('low'), t.Literal('normal'), t.Literal('high'), t.Literal('urgent')],
  { $id: 'TodoPriority' },
)
const TodoStatus = t.Union([t.Literal('all'), t.Literal('open'), t.Literal('completed')])

function healthPayload(): { readonly status: 'ok'; readonly version: string } {
  return { status: 'ok', version: VERSION }
}

const TodoSchema = t.Object(
  {
    id: t.String({ format: 'uuid' }),
    input: t.String(),
    title: t.String(),
    tags: t.Array(t.String()),
    context: NullableString,
    priority: TodoPriority,
    dueDate: NullableString,
    completed: t.Boolean(),
    completedAt: NullableString,
    createdAt: t.String({ format: 'date-time' }),
    updatedAt: t.String({ format: 'date-time' }),
  },
  { $id: 'Todo' },
)

const ApiErrorSchema = t.Object({ code: t.String(), message: t.String() }, { $id: 'ApiError' })

export interface AppDependencies {
  readonly todos: TodoRepository
  readonly parser: TodoParser
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

export function createApp(dependencies: AppDependencies) {
  return new Elysia({ name: 'todo-server', prefix: '/api' })
    .use(
      openapi({
        path: '/openapi',
        documentation: {
          info: {
            title: 'Todo API',
            version: VERSION,
            description:
              'An intentionally over-engineered todo API demonstrating Bun, Elysia, Drizzle, Postgres, and a Rust parser.',
          },
          tags: [
            { name: 'system', description: 'Health and build identity' },
            { name: 'todos', description: 'Todo lifecycle operations' },
          ],
        },
      }),
    )
    .get('/health', healthPayload, {
      response: t.Object({ status: t.Literal('ok'), version: t.String() }),
      detail: { operationId: 'health', tags: ['system'], summary: 'Health check' },
    })
    .get(
      '/version',
      () => ({ ...versionPayload(), nativeVersion: dependencies.parser.version() }),
      {
        response: t.Object({
          version: t.String(),
          tag: NullableString,
          commit: t.String(),
          nativeVersion: t.String(),
        }),
        detail: { operationId: 'version', tags: ['system'], summary: 'Build identity' },
      },
    )
    .get(
      '/v1/todos',
      async ({ query }) => ({
        items: await dependencies.todos.list(query.status ?? 'open', query.limit ?? 50),
      }),
      {
        query: t.Object({
          status: t.Optional(TodoStatus),
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
        }),
        response: t.Object({ items: t.Array(TodoSchema) }),
        detail: { operationId: 'listTodos', tags: ['todos'], summary: 'List todos' },
      },
    )
    .post(
      '/v1/todos',
      async ({ body, status }) => {
        try {
          const parsed = dependencies.parser.parse(body.input)
          const todo = await dependencies.todos.create({ input: body.input, parsed })
          return status(201, todo)
        } catch (error) {
          return status(400, { code: 'invalid_todo', message: errorMessage(error) })
        }
      },
      {
        body: t.Object({ input: t.String({ minLength: 1, maxLength: 2_000 }) }),
        response: {
          201: TodoSchema,
          400: ApiErrorSchema,
        },
        detail: { operationId: 'createTodo', tags: ['todos'], summary: 'Create a todo' },
      },
    )
    .get(
      '/v1/todos/:id',
      async ({ params, status }) => {
        const todo = await dependencies.todos.find(params.id)
        return todo ?? status(404, { code: 'not_found', message: 'Todo was not found' })
      },
      {
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        response: { 200: TodoSchema, 404: ApiErrorSchema },
        detail: { operationId: 'getTodo', tags: ['todos'], summary: 'Get one todo' },
      },
    )
    .patch(
      '/v1/todos/:id',
      async ({ params, body, status }) => {
        if (body.title === undefined && body.completed === undefined) {
          return status(400, {
            code: 'empty_patch',
            message: 'Provide title or completed',
          })
        }

        const patch: UpdateTodoInput = {
          ...(body.title === undefined ? {} : { title: body.title }),
          ...(body.completed === undefined ? {} : { completed: body.completed }),
        }
        const todo = await dependencies.todos.update(params.id, patch)
        return todo ?? status(404, { code: 'not_found', message: 'Todo was not found' })
      },
      {
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        body: t.Object({
          title: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
          completed: t.Optional(t.Boolean()),
        }),
        response: { 200: TodoSchema, 400: ApiErrorSchema, 404: ApiErrorSchema },
        detail: { operationId: 'updateTodo', tags: ['todos'], summary: 'Update a todo' },
      },
    )
    .delete(
      '/v1/todos/:id',
      async ({ params, status }) => {
        const deleted = await dependencies.todos.delete(params.id)
        return deleted
          ? { deleted: true }
          : status(404, { code: 'not_found', message: 'Todo was not found' })
      },
      {
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        response: {
          200: t.Object({ deleted: t.Literal(true) }),
          404: ApiErrorSchema,
        },
        detail: { operationId: 'deleteTodo', tags: ['todos'], summary: 'Delete a todo' },
      },
    )
}

export type App = ReturnType<typeof createApp>
