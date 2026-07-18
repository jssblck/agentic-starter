import type { TodoDto } from '@starter/api'

export interface TodoSections {
  readonly completed: readonly TodoDto[]
  readonly open: readonly TodoDto[]
}

export function partitionTodos(todos: readonly TodoDto[]): TodoSections {
  return {
    completed: todos.filter((todo) => todo.completed),
    open: todos.filter((todo) => !todo.completed),
  }
}

export function todoCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'task' : 'tasks'}`
}
