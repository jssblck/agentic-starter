export { VERSION as DOMAIN_VERSION } from '@starter/version'

export type TodoPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TodoStatusFilter = 'all' | 'open' | 'completed'

export interface ParsedTodo {
  readonly title: string
  readonly tags: string[]
  readonly context: string | null
  readonly priority: TodoPriority
  readonly dueDate: string | null
}

export interface Todo {
  readonly id: string
  readonly input: string
  readonly title: string
  readonly tags: string[]
  readonly context: string | null
  readonly priority: TodoPriority
  readonly dueDate: string | null
  readonly completed: boolean
  readonly completedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateTodoInput {
  readonly input: string
  readonly parsed: ParsedTodo
}

export interface UpdateTodoInput {
  readonly title?: string
  readonly completed?: boolean
}

export function isTodoPriority(value: unknown): value is TodoPriority {
  return value === 'low' || value === 'normal' || value === 'high' || value === 'urgent'
}

export function isTodoStatusFilter(value: unknown): value is TodoStatusFilter {
  return value === 'all' || value === 'open' || value === 'completed'
}
