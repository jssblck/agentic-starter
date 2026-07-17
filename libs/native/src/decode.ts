import { isTodoPriority, type ParsedTodo } from '@starter/domain'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') throw new Error(`Native parser returned a non-string ${key}`)
  return value
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new Error(`Native parser returned an invalid nullable string for ${key}`)
  }
  return value
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`Native parser returned an invalid string array for ${key}`)
  }
  return value
}

export function decodeParsedTodoJson(json: string): ParsedTodo {
  const value: unknown = JSON.parse(json)
  if (!isRecord(value)) throw new Error('Native parser returned a non-object result')

  const priority = value['priority']
  if (!isTodoPriority(priority)) throw new Error('Native parser returned an invalid priority')

  return {
    title: readString(value, 'title'),
    tags: readStringArray(value, 'tags'),
    context: readNullableString(value, 'context'),
    priority,
    dueDate: readNullableString(value, 'dueDate'),
  }
}
