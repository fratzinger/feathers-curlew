import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from 'feathers-curlew'
import { capture } from '../../../test/helpers'

let app: any

beforeEach(async () => {
  app = feathers()
  // A second service WITHOUT pagination: `$limit: 0` returns a bare array there,
  // so counting from `total` alone silently reported 0 for every such service.
  app.use('logs', new MemoryService({ multi: true, paginate: false }))
  app.use(
    'books',
    new MemoryService({ multi: true, paginate: { default: 10, max: 50 } }),
  )
  app.configure(curlew())
  await app.setup()
  await app.service('books').create([
    { title: 'A', year: 2001 },
    { title: 'B', year: 2002 },
    { title: 'C', year: 2003 },
  ])
})

afterEach(async () => {
  await app.teardown?.()
})

async function run(argv: string[]) {
  const cap = capture()
  try {
    const code = await runCurlew(app, { argv, setup: false, teardown: false })
    return { code, json: () => JSON.parse(cap.stdout().trim()) }
  } finally {
    cap.restore()
  }
}

describe('findOne', () => {
  it('returns a single matching record, not an array', async () => {
    const one = (await run(['findOne', 'books', '-q', '{"title":"B"}'])).json()
    expect(Array.isArray(one)).toBe(false)
    expect(one.title).toBe('B')
  })

  it('returns null when nothing matches', async () => {
    expect(
      (await run(['findOne', 'books', '-q', '{"title":"Z"}'])).json(),
    ).toBeNull()
  })

  it('works through the generic `call` command', async () => {
    const one = (
      await run(['call', 'books', 'findOne', '-q', '{"year":2003}'])
    ).json()
    expect(one.title).toBe('C')
  })
})

describe('exists', () => {
  it('checks existence by query', async () => {
    expect(
      (await run(['exists', 'books', '-q', '{"title":"A"}'])).json(),
    ).toEqual({ exists: true })
    expect(
      (await run(['exists', 'books', '-q', '{"title":"Z"}'])).json(),
    ).toEqual({ exists: false })
  })

  it('checks existence by id without erroring on a miss', async () => {
    const created = (
      await run(['create', 'books', '-d', '{"title":"D"}'])
    ).json()

    const hit = await run(['exists', 'books', String(created.id)])
    expect(hit.code).toBe(0)
    expect(hit.json()).toEqual({ exists: true })

    const miss = await run(['exists', 'books', '999999'])
    expect(miss.code).toBe(0)
    expect(miss.json()).toEqual({ exists: false })
  })
})

describe('count and exists on an unpaginated service', () => {
  it('counts the real number of matches, not 0', async () => {
    await app
      .service('logs')
      .create([{ level: 'warn' }, { level: 'warn' }, { level: 'info' }])
    expect((await run(['count', 'logs'])).json()).toBe(3)
    expect(
      (await run(['count', 'logs', '-q', '{"level":"warn"}'])).json(),
    ).toBe(2)
  })

  it('reports existence by query correctly', async () => {
    await app.service('logs').create({ level: 'error' })
    expect(
      (await run(['exists', 'logs', '-q', '{"level":"error"}'])).json(),
    ).toEqual({ exists: true })
    expect(
      (await run(['exists', 'logs', '-q', '{"level":"nope"}'])).json(),
    ).toEqual({ exists: false })
  })
})
