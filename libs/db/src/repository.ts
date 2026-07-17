import { desc, eq } from 'drizzle-orm'
import type { CreateTodoInput, Todo, TodoStatusFilter, UpdateTodoInput } from '@starter/domain'

import type { Database } from './client.ts'
import { todos, type TodoRow } from './schema.ts'

export interface TodoRepository {
  list(status: TodoStatusFilter, limit: number): Promise<Todo[]>
  find(id: string): Promise<Todo | null>
  create(input: CreateTodoInput): Promise<Todo>
  update(id: string, patch: UpdateTodoInput): Promise<Todo | null>
  delete(id: string): Promise<boolean>
}

function mapTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    input: row.input,
    title: row.title,
    tags: row.tags,
    context: row.context,
    priority: row.priority,
    dueDate: row.dueDate,
    completed: row.completed,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function createTodoRepository(db: Database): TodoRepository {
  return {
    async list(status, limit) {
      const base = db.select().from(todos)
      const rows =
        status === 'all'
          ? await base.orderBy(desc(todos.createdAt)).limit(limit)
          : await base
              .where(eq(todos.completed, status === 'completed'))
              .orderBy(desc(todos.createdAt))
              .limit(limit)
      return rows.map(mapTodo)
    },

    async find(id) {
      const rows = await db.select().from(todos).where(eq(todos.id, id)).limit(1)
      const row = rows[0]
      return row === undefined ? null : mapTodo(row)
    },

    async create({ input, parsed }) {
      const rows = await db
        .insert(todos)
        .values({
          input,
          title: parsed.title,
          tags: [...parsed.tags],
          context: parsed.context,
          priority: parsed.priority,
          dueDate: parsed.dueDate,
        })
        .returning()
      const row = rows[0]
      if (row === undefined) throw new Error('Postgres did not return the inserted todo')
      return mapTodo(row)
    },

    async update(id, patch) {
      const values: {
        title?: string
        completed?: boolean
        completedAt?: Date | null
        updatedAt: Date
      } = { updatedAt: new Date() }

      if (patch.title !== undefined) values.title = patch.title
      if (patch.completed !== undefined) {
        values.completed = patch.completed
        values.completedAt = patch.completed ? new Date() : null
      }

      const rows = await db.update(todos).set(values).where(eq(todos.id, id)).returning()
      const row = rows[0]
      return row === undefined ? null : mapTodo(row)
    },

    async delete(id) {
      const rows = await db.delete(todos).where(eq(todos.id, id)).returning({ id: todos.id })
      return rows.length > 0
    },
  }
}
