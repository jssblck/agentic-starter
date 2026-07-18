import { describe, expect, test } from 'bun:test'
import type { TodoDto } from '@starter/api'

import { partitionTodos, todoCountLabel } from './todo-view.ts'

function todo(id: string, completed: boolean): TodoDto {
  return {
    completed,
    completedAt: completed ? '2026-07-18T18:00:00.000Z' : null,
    context: null,
    createdAt: '2026-07-18T17:00:00.000Z',
    dueDate: null,
    id,
    input: `Task ${id}`,
    priority: 'normal',
    tags: [],
    title: `Task ${id}`,
    updatedAt: '2026-07-18T18:00:00.000Z',
  }
}

describe('todo view logic', () => {
  test('partitions todos by completion without changing their order', () => {
    const sections = partitionTodos([
      todo('3bc91cc5-4b19-4d71-a335-840cd10eed38', false),
      todo('9d823e42-701c-491e-89eb-c56a2649a330', true),
      todo('3fddcf17-154f-4b85-bb1a-d69e75ac1ff0', false),
    ])

    expect(sections.open.map(({ title }) => title)).toEqual([
      'Task 3bc91cc5-4b19-4d71-a335-840cd10eed38',
      'Task 3fddcf17-154f-4b85-bb1a-d69e75ac1ff0',
    ])
    expect(sections.completed.map(({ title }) => title)).toEqual([
      'Task 9d823e42-701c-491e-89eb-c56a2649a330',
    ])
  })

  test('formats singular and plural task counts', () => {
    expect(todoCountLabel(1)).toBe('1 task')
    expect(todoCountLabel(2)).toBe('2 tasks')
  })
})
