import type { CreateTodoInput, Todo, TodoStatusFilter, UpdateTodoInput } from '@starter/domain'

import type { TodoRepository } from './repository.ts'

export function createMemoryTodoRepository(initial: readonly Todo[] = []): TodoRepository {
  let rows = initial.map((todo) => ({ ...todo, tags: [...todo.tags] }))

  function findIndex(id: string): number {
    return rows.findIndex((todo) => todo.id === id)
  }

  return {
    async list(status: TodoStatusFilter, limit: number) {
      return rows
        .filter((todo) => status === 'all' || todo.completed === (status === 'completed'))
        .slice(0, limit)
    },

    async find(id: string) {
      return rows.find((todo) => todo.id === id) ?? null
    },

    async create({ input, parsed }: CreateTodoInput) {
      const now = new Date().toISOString()
      const todo: Todo = {
        id: crypto.randomUUID(),
        input,
        title: parsed.title,
        tags: [...parsed.tags],
        context: parsed.context,
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      rows = [todo, ...rows]
      return todo
    },

    async update(id: string, patch: UpdateTodoInput) {
      const index = findIndex(id)
      const current = rows[index]
      if (current === undefined) return null

      const completed = patch.completed ?? current.completed
      const updated: Todo = {
        ...current,
        title: patch.title ?? current.title,
        completed,
        completedAt:
          patch.completed === undefined
            ? current.completedAt
            : patch.completed
              ? new Date().toISOString()
              : null,
        updatedAt: new Date().toISOString(),
      }
      rows = rows.map((todo, rowIndex) => (rowIndex === index ? updated : todo))
      return updated
    },

    async delete(id: string) {
      const previousLength = rows.length
      rows = rows.filter((todo) => todo.id !== id)
      return rows.length !== previousLength
    },
  }
}
