import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createWebRoutes } from './web.ts'

const base = mkdtempSync(join(tmpdir(), 'web-static-'))
const dist = join(base, 'dist')
mkdirSync(dist)
await Bun.write(join(dist, 'index.html'), '<!doctype html><title>app</title>')
await Bun.write(join(dist, 'assets', 'main.js'), 'console.log(1)')
await Bun.write(join(base, 'secret.txt'), 'top secret')

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

async function request(path: string): Promise<Response> {
  return createWebRoutes(dist).handle(new Request(`http://local.test${path}`))
}

describe('web static routes', () => {
  test('serves built assets and falls back to index.html for SPA routes', async () => {
    expect(await (await request('/assets/main.js')).text()).toBe('console.log(1)')
    expect(await (await request('/')).text()).toContain('<title>app</title>')
    expect(await (await request('/some/client/route')).text()).toContain('<title>app</title>')
  })

  test('keeps /api out of the fallback', async () => {
    expect((await request('/api/missing')).status).toBe(404)
  })

  test('never serves files outside the dist root', async () => {
    for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt']) {
      const body = await (await request(path)).text()
      expect(body).not.toContain('top secret')
    }
  })
})
