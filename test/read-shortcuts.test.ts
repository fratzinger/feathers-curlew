import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from '../src'
import { capture } from './helpers'

let app: any

beforeEach(async () => {
  app = feathers()
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
    const one = (await run(['books', 'findOne', '-q', '{"title":"B"}'])).json()
    expect(Array.isArray(one)).toBe(false)
    expect(one.title).toBe('B')
  })

  it('returns null when nothing matches', async () => {
    expect(
      (await run(['books', 'findOne', '-q', '{"title":"Z"}'])).json(),
    ).toBeNull()
  })

  it('works through the generic service command', async () => {
    const one = (
      await run(['service', 'books', 'findOne', '-q', '{"year":2003}'])
    ).json()
    expect(one.title).toBe('C')
  })
})

describe('exists', () => {
  it('checks existence by query', async () => {
    expect(
      (await run(['books', 'exists', '-q', '{"title":"A"}'])).json(),
    ).toEqual({ exists: true })
    expect(
      (await run(['books', 'exists', '-q', '{"title":"Z"}'])).json(),
    ).toEqual({ exists: false })
  })

  it('checks existence by id without erroring on a miss', async () => {
    const created = (
      await run(['books', 'create', '-d', '{"title":"D"}'])
    ).json()

    const hit = await run(['books', 'exists', String(created.id)])
    expect(hit.code).toBe(0)
    expect(hit.json()).toEqual({ exists: true })

    const miss = await run(['books', 'exists', '999999'])
    expect(miss.code).toBe(0)
    expect(miss.json()).toEqual({ exists: false })
  })
})
