import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createApp } from '@starter/api/server'
import { createMemoryTodoRepository } from '@starter/db'
import type { TodoParser } from '@starter/native'
import { VERSION } from '@starter/version'

// The Elysia schemas are the contract source, so the published OpenAPI
// document is derived from the running app rather than maintained by hand.
// A stub parser keeps the export free of the native addon.
const parser: TodoParser = {
  parse(input) {
    return { title: input, tags: [], context: null, priority: 'normal', dueDate: null }
  },
  version() {
    return VERSION
  },
}

const app = createApp({ todos: createMemoryTodoRepository(), parser })
const response = await app.handle(new Request('http://local.export/api/openapi/json'))
if (!response.ok) {
  throw new Error(`OpenAPI document request failed with HTTP ${response.status}`)
}

const specText = await response.text()
const spec: unknown = JSON.parse(specText)
if (typeof spec !== 'object' || spec === null || !('openapi' in spec)) {
  throw new Error('OpenAPI response did not contain an OpenAPI document')
}

const outDirectory = join(import.meta.dir, '..', 'build')
await mkdir(outDirectory, { recursive: true })
await Bun.write(join(outDirectory, 'openapi.json'), specText)

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Todo API reference</title>
</head>
<body>
<div id="app"></div>
<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
<script>
Scalar.createApiReference('#app', { content: ${specText} })
</script>
</body>
</html>
`
await Bun.write(join(outDirectory, 'api-reference.html'), html)
console.log(`Exported build/openapi.json and build/api-reference.html for ${VERSION}`)
