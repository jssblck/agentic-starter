import { resolve, sep } from 'node:path'
import { Elysia } from 'elysia'

// The compiled SPA is served same-origin with the API so the browser needs no
// CORS setup or configured API URL. Unknown non-API paths fall back to
// index.html because the SPA router owns them; /api stays out of the fallback
// so missing API routes fail loudly instead of returning HTML.
export function createWebRoutes(distDirectory: string) {
  const root = resolve(distDirectory)
  const index = Bun.file(resolve(root, 'index.html'))

  return new Elysia({ name: 'web-static' }).get('/*', async ({ path, status }) => {
    if (path === '/api' || path.startsWith('/api/')) {
      return status(404, 'Not found')
    }

    const resolved = resolve(root, path.replace(/^\/+/, ''))
    if (resolved !== root && !resolved.startsWith(root + sep)) {
      return status(404, 'Not found')
    }

    const file = Bun.file(resolved)
    if (resolved !== root && (await file.exists())) return file
    return index
  })
}
