import type { ParsedTodo } from '@starter/domain'

export interface TodoParser {
  parse(input: string): ParsedTodo
  version(): string
}
