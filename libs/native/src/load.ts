import { VERSION } from '@starter/version'

import { decodeParsedTodoJson } from './decode.ts'
import type { TodoParser } from './types.ts'

interface NativeBinding {
  parseTodoJson(input: string): string
  nativeVersion(): string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNativeBinding(value: unknown): value is NativeBinding {
  return (
    isRecord(value) &&
    typeof value['parseTodoJson'] === 'function' &&
    typeof value['nativeVersion'] === 'function'
  )
}

function loadBinding(): NativeBinding {
  // Keep this direct static require. Bun can then embed the matching .node file in a
  // standalone executable rather than depending on a runtime package layout.
  const loaded: unknown = require('../artifacts/todo_parser.node')
  if (!isNativeBinding(loaded)) {
    throw new Error('The native addon does not expose the expected todo parser ABI')
  }
  return loaded
}

export function createNativeTodoParser(expectedVersion = VERSION): TodoParser {
  const binding = loadBinding()
  const nativeVersion = binding.nativeVersion()
  if (nativeVersion !== expectedVersion) {
    throw new Error(
      `Native addon version ${nativeVersion} does not match TypeScript version ${expectedVersion}. Run bun run native:ensure.`,
    )
  }

  return {
    parse(input) {
      return decodeParsedTodoJson(binding.parseTodoJson(input))
    },
    version() {
      return nativeVersion
    },
  }
}
