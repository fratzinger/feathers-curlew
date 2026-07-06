import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from '../src'
import { capture } from './helpers'

class Widgets extends MemoryService {
  async recalc(data: any, _params: any) {
    return { recalculated: true, factor: data?.factor ?? 1 }
  }
}

let app: any

beforeEach(async () => {
  app = feathers()
  // Read-only: only find + get are exposed.
  app.use('readonly', new MemoryService({ paginate: false }), {
    methods: ['find', 'get'],
  })
  // Full CRUD + a custom method.
  app.use('widgets', new Widgets({ multi: true, paginate: false }), {
    methods: ['find', 'get', 'create', 'patch', 'remove', 'recalc'],
  })
  app.configure(curlew())
  await app.setup()
})

afterEach(async () => {
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

describe('method filtering', () => {
  it('does not generate CRUD commands a service does not expose', async () => {
    const attempt = await run(['readonly', 'create', '-d', '{"x":1}'])
    expect(attempt.code).toBe(0)
    expect(attempt.out.trim()).toBe('') // usage shown, create not executed

    const items = (await run(['readonly', 'find'])).json()
    expect(items).toHaveLength(0) // nothing was created
  })

  it('keeps the commands a service does expose', async () => {
    expect((await run(['readonly', 'find'])).code).toBe(0)
    // get IS exposed → the command exists and runs (404 → exit 1), proving it wasn't filtered out.
    expect((await run(['readonly', 'get', '999'])).code).toBe(1)
  })

  it('exposes custom methods as named commands', async () => {
    const result = (
      await run(['widgets', 'recalc', '-d', '{"factor":3}'])
    ).json()
    expect(result).toEqual({ recalculated: true, factor: 3 })
  })

  it('keeps standard CRUD for a full service', async () => {
    const created = (
      await run(['widgets', 'create', '-d', '{"name":"w1"}'])
    ).json()
    expect(created.name).toBe('w1')
  })

  it('describe reflects the exposed methods', async () => {
    expect((await run(['describe', 'readonly'])).json().methods).toEqual([
      'find',
      'get',
    ])
    expect((await run(['describe', 'widgets'])).json().methods).toContain(
      'recalc',
    )
  })
})
