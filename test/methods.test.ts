import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from '../src'
import { capture } from './helpers'

// A paginated service with a Feathers custom method.
class Things extends MemoryService {
  async summarize(data: any, _params: any) {
    return { summarized: true, tag: data?.tag ?? null }
  }
}

let app: any

beforeAll(async () => {
  app = feathers()
  app.use(
    'things',
    new Things({ multi: true, paginate: { default: 2, max: 10 } }),
    {
      methods: ['find', 'get', 'create', 'patch', 'remove', 'summarize'],
    },
  )
  app.configure(curlew())
  await app.setup()
  for (const title of ['a', 'b', 'c', 'd', 'e'])
    await app.service('things').create({ title })
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
      json: () => JSON.parse(cap.stdout().trim()),
      errorJson: () => JSON.parse(cap.stderr().trim()),
    }
  } finally {
    cap.restore()
  }
}

describe('custom methods', () => {
  it('calls a custom method via the generic service command', async () => {
    const { code, json } = await run([
      'service',
      'things',
      'summarize',
      '--data',
      '{"tag":"x"}',
    ])
    expect(code).toBe(0)
    expect(json()).toEqual({ summarized: true, tag: 'x' })
  })

  it('errors clearly for an unknown method', async () => {
    const { code, errorJson } = await run([
      'service',
      'things',
      'nope',
      '--data',
      '{}',
    ])
    expect(code).toBe(1)
    expect(errorJson().error.code).toBe('E_UNKNOWN_METHOD')
  })
})

describe('shorthands', () => {
  it('count returns the bare total via $limit:0', async () => {
    const { code, json } = await run(['things', 'count'])
    expect(code).toBe(0)
    expect(json()).toBe(5)
  })

  it('count honors a query (via the -q alias)', async () => {
    const { json } = await run(['things', 'count', '-q', '{"title":"a"}'])
    expect(json()).toBe(1)
  })

  it('findAll disables pagination and returns every record', async () => {
    const { code, json } = await run(['things', 'findAll'])
    expect(code).toBe(0)
    const all = json()
    expect(Array.isArray(all)).toBe(true)
    expect(all).toHaveLength(5)
  })

  it('find stays paginated by default', async () => {
    const result = (await run(['things', 'find'])).json()
    expect(result.total).toBe(5)
    expect(result.data).toHaveLength(2)
  })

  it('create accepts the -d alias for --data', async () => {
    const { code, json } = await run([
      'service',
      'things',
      'create',
      '-d',
      '{"title":"z"}',
    ])
    expect(code).toBe(0)
    expect(json().title).toBe('z')
  })
})

describe('describe', () => {
  it('lists the service methods including custom ones', async () => {
    const { code, json } = await run(['describe', 'things'])
    expect(code).toBe(0)
    const { methods } = json()
    expect(methods).toContain('find')
    expect(methods).toContain('summarize')
  })
})
