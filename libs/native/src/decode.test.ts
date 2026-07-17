import { describe, expect, test } from 'bun:test'

import { decodeParsedTodoJson } from './decode.ts'

describe('decodeParsedTodoJson', () => {
  test('accepts the exact native contract', () => {
    expect(
      decodeParsedTodoJson(
        JSON.stringify({
          title: 'Buy oat milk',
          tags: ['errands'],
          context: 'home',
          priority: 'high',
          dueDate: '2026-08-01',
        }),
      ),
    ).toEqual({
      title: 'Buy oat milk',
      tags: ['errands'],
      context: 'home',
      priority: 'high',
      dueDate: '2026-08-01',
    })
  })

  test('rejects an invalid priority from the native boundary', () => {
    expect(() =>
      decodeParsedTodoJson(
        JSON.stringify({
          title: 'Bad value',
          tags: [],
          context: null,
          priority: 'eventually',
          dueDate: null,
        }),
      ),
    ).toThrow('invalid priority')
  })
})
