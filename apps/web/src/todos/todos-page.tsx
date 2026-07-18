import { Checkbox } from '@base-ui-components/react/checkbox'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { startTransition, useActionState, useOptimistic } from 'react'
import type { TodoDto } from '@starter/api'

import { useTodoApi } from '../api-context.tsx'
import { partitionTodos, todoCountLabel } from './todo-view.ts'

const OPTIMISTIC_TODO_ID = 'optimistic-new-todo'
const todosQueryKey: readonly ['todos'] = ['todos']

type ActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'success' }

type AddTodoState =
  | { readonly status: 'idle'; readonly revision: number }
  | { readonly status: 'error'; readonly message: string; readonly revision: number }
  | { readonly status: 'success'; readonly revision: number }

const initialActionState: ActionState = { status: 'idle' }
const initialAddTodoState: AddTodoState = { status: 'idle', revision: 0 }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed'
}

function readTodoInput(formData: FormData): string {
  const value: unknown = formData.get('input')
  if (typeof value !== 'string') throw new Error('Enter a todo')

  const input = value.trim()
  if (input.length === 0) throw new Error('Enter a todo')
  return input
}

function optimisticTodo(input: string): TodoDto {
  const now = new Date().toISOString()
  return {
    completed: false,
    completedAt: null,
    context: null,
    createdAt: now,
    dueDate: null,
    id: OPTIMISTIC_TODO_ID,
    input,
    priority: 'normal',
    tags: [],
    title: input,
    updatedAt: now,
  }
}

function TodoRow({ todo }: { readonly todo: TodoDto }) {
  const api = useTodoApi()
  const queryClient = useQueryClient()
  const isOptimisticTodo = todo.id === OPTIMISTIC_TODO_ID
  const [optimisticCompleted, setOptimisticCompleted] = useOptimistic(
    todo.completed,
    (_current, completed: boolean) => completed,
  )
  const updateTodo = useMutation({
    mutationFn: (completed: boolean) => api.update(todo.id, { completed }),
  })
  const [actionState, toggleTodo, isUpdating] = useActionState(
    async (_previous: ActionState, completed: boolean): Promise<ActionState> => {
      setOptimisticCompleted(completed)
      try {
        const updated = await updateTodo.mutateAsync(completed)
        queryClient.setQueryData<readonly TodoDto[]>(todosQueryKey, (current) =>
          current === undefined
            ? [updated]
            : current.map((item) => (item.id === updated.id ? updated : item)),
        )
        return { status: 'success' }
      } catch (error) {
        return { status: 'error', message: errorMessage(error) }
      }
    },
    initialActionState,
  )

  return (
    <li className="group py-3">
      <div className="flex min-h-10 items-center gap-4">
        <Checkbox.Root
          aria-label={`Mark ${todo.title} as ${optimisticCompleted ? 'open' : 'completed'}`}
          checked={optimisticCompleted}
          className="grid size-6 shrink-0 place-items-center rounded-control border border-line bg-surface text-surface transition-colors outline-none data-[checked]:border-accent data-[checked]:bg-accent focus-visible:ring-3 focus-visible:ring-focus/30 disabled:cursor-wait disabled:opacity-55"
          disabled={isUpdating || isOptimisticTodo}
          onCheckedChange={(checked) => {
            startTransition(() => {
              toggleTodo(checked)
            })
          }}
        >
          <Checkbox.Indicator className="checkbox-indicator size-3" />
        </Checkbox.Root>
        <div className="min-w-0 flex-1">
          <p
            className={`text-[0.98rem] leading-6 font-medium ${optimisticCompleted ? 'text-muted line-through' : 'text-ink'}`}
          >
            {todo.title}
          </p>
          {(todo.tags.length > 0 || todo.dueDate !== null) && (
            <p className="mt-0.5 truncate text-sm text-muted">
              {[...todo.tags.map((tag) => `#${tag}`), todo.dueDate].filter(Boolean).join('  ')}
            </p>
          )}
        </div>
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">
          {isOptimisticTodo ? 'adding' : todo.priority}
        </span>
      </div>
      {actionState.status === 'error' && (
        <p className="mt-2 pl-10 text-sm text-error" role="alert">
          {actionState.message}
        </p>
      )}
    </li>
  )
}

function TodoSection({
  heading,
  todos,
}: {
  readonly heading: string
  readonly todos: readonly TodoDto[]
}) {
  if (todos.length === 0) return null

  const headingId = `${heading.toLowerCase()}-todos`
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <div className="flex items-baseline justify-between border-b border-line pb-2">
        <h2 className="text-sm font-bold tracking-[0.12em] text-muted uppercase" id={headingId}>
          {heading}
        </h2>
        <span className="text-sm text-muted">{todoCountLabel(todos.length)}</span>
      </div>
      <ul className="divide-y divide-line">
        {todos.map((todo) => (
          <TodoRow key={todo.id} todo={todo} />
        ))}
      </ul>
    </section>
  )
}

function LoadingTodos() {
  return (
    <div aria-label="Loading todos" className="mt-8 space-y-3" role="status">
      {['first', 'second', 'third'].map((key) => (
        <div className="h-16 animate-pulse rounded-panel bg-soft" key={key} />
      ))}
    </div>
  )
}

export function TodosPage() {
  const api = useTodoApi()
  const queryClient = useQueryClient()
  const todosQuery = useQuery({
    queryFn: () => api.list('all'),
    queryKey: todosQueryKey,
  })
  const createTodo = useMutation({ mutationFn: (input: string) => api.create(input) })
  const [visibleTodos, addOptimisticTodo] = useOptimistic(
    todosQuery.data ?? [],
    (current: readonly TodoDto[], todo: TodoDto) => [
      todo,
      ...current.filter((item) => item.id !== OPTIMISTIC_TODO_ID && item.input !== todo.input),
    ],
  )
  const [addState, addTodo, isAdding] = useActionState(
    async (previous: AddTodoState, formData: FormData): Promise<AddTodoState> => {
      let input: string
      try {
        input = readTodoInput(formData)
      } catch (error) {
        return { status: 'error', message: errorMessage(error), revision: previous.revision }
      }

      addOptimisticTodo(optimisticTodo(input))
      try {
        const created = await createTodo.mutateAsync(input)
        queryClient.setQueryData<readonly TodoDto[]>(todosQueryKey, (current) => [
          created,
          ...(current ?? []).filter((todo) => todo.id !== created.id),
        ])
        return { status: 'success', revision: previous.revision + 1 }
      } catch (error) {
        return { status: 'error', message: errorMessage(error), revision: previous.revision }
      }
    },
    initialAddTodoState,
  )
  const sections = partitionTodos(visibleTodos)

  return (
    <>
      <form action={addTodo} key={addState.revision}>
        <label className="text-sm font-semibold text-ink" htmlFor="todo-input">
          New todo
        </label>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            className="min-h-12 w-full rounded-control border border-line bg-surface px-4 text-base text-ink outline-none placeholder:text-muted focus:border-accent focus:ring-3 focus:ring-focus/25"
            disabled={isAdding}
            id="todo-input"
            maxLength={2000}
            name="input"
            placeholder="Review the API contract tomorrow #backend"
            required
          />
          <button
            className="min-h-12 rounded-control bg-accent px-6 font-semibold whitespace-nowrap text-on-accent transition-transform active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isAdding}
            type="submit"
          >
            {isAdding ? 'Adding...' : 'Add todo'}
          </button>
        </div>
      </form>

      {addState.status === 'error' && (
        <p className="mt-4 rounded-control bg-error-soft px-4 py-3 text-sm text-error" role="alert">
          {addState.message}
        </p>
      )}

      {todosQuery.isPending && <LoadingTodos />}
      {todosQuery.isError && (
        <section
          className="mt-8 rounded-panel border border-error/30 bg-error-soft p-5"
          role="alert"
        >
          <h2 className="font-semibold text-error">Could not load todos</h2>
          <p className="mt-1 text-sm leading-6 text-error">{errorMessage(todosQuery.error)}</p>
          <button
            className="mt-4 rounded-control border border-error/40 px-4 py-2 text-sm font-semibold text-error active:translate-y-px"
            onClick={() => {
              void todosQuery.refetch()
            }}
            type="button"
          >
            Try again
          </button>
        </section>
      )}
      {todosQuery.isSuccess && visibleTodos.length === 0 && (
        <section className="mt-10 rounded-panel border border-line bg-surface p-8 text-center">
          <h2 className="text-lg font-semibold">Your list is clear</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Add a todo above to start the list.</p>
        </section>
      )}
      {todosQuery.isSuccess && visibleTodos.length > 0 && (
        <div aria-live="polite">
          <TodoSection heading="Open" todos={sections.open} />
          <TodoSection heading="Completed" todos={sections.completed} />
        </div>
      )}
    </>
  )
}
