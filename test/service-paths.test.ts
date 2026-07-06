import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from '../src'
import { capture } from './helpers'

let app: any

beforeAll(async () => {
  app = feathers()
  app.use('user-settings', new MemoryService({ multi: true, paginate: false }))
  app.use(
    'v1/user-settings',
    new MemoryService({ multi: true, paginate: false }),
  )
  app.configure(curlew())
  await app.setup()
})

afterAll(async () => {
  await app.teardown?.()
})

async function run(argv: string[]) {
  const cap = capture()
  try {
    const code = await runCurlew(app, { argv, setup: false, teardown: false })
    return {
      code,
      out: cap.stdout(),
      json: () => JSON.parse(cap.stdout().trim()),
    }
  } finally {
    cap.restore()
  }
}

describe('service paths with hyphens and slashes', () => {
  it('generates a named command for a hyphenated service', async () => {
    const created = (
      await run([
        'user-settings',
        'create',
        '--data',
        '{"key":"theme","value":"dark"}',
      ])
    ).json()
    expect(created.key).toBe('theme')

    const found = (await run(['user-settings', 'find'])).json()
    expect(Array.isArray(found)).toBe(true)
    expect(found).toHaveLength(1)
  })

  it('lists both the hyphen and slash services', async () => {
    const services = (await run(['services'])).json()
    expect(services).toContain('user-settings')
    expect(services).toContain('v1/user-settings')
  })

  it('reaches a nested (slash) service via the generic `service` command', async () => {
    const created = (
      await run([
        'service',
        'v1/user-settings',
        'create',
        '--data',
        '{"key":"lang","value":"de"}',
      ])
    ).json()
    expect(created.key).toBe('lang')

    const found = (await run(['service', 'v1/user-settings', 'find'])).json()
    expect(found).toHaveLength(1)
  })

  it('does not create a bare named command for a slash path (falls back to usage)', async () => {
    const { code, out } = await run(['v1/user-settings', 'find'])
    expect(code).toBe(0)
    // No JSON result is written: it showed usage instead of executing find,
    // because a slash path is not exposed as a named command.
    expect(out.trim()).toBe('')
  })

  it('describe works for a slash path', async () => {
    const { methods } = (await run(['describe', 'v1/user-settings'])).json()
    expect(methods).toContain('find')
  })
})
