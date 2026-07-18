import type { TodoApi } from '@starter/api'
import { createContext, use, type ReactNode } from 'react'

const TodoApiContext = createContext<TodoApi | null>(null)

export function TodoApiProvider({
  api,
  children,
}: {
  readonly api: TodoApi
  readonly children: ReactNode
}) {
  return <TodoApiContext value={api}>{children}</TodoApiContext>
}

export function useTodoApi(): TodoApi {
  const api = use(TodoApiContext)
  if (api === null) throw new Error('TodoApiProvider is missing')
  return api
}
