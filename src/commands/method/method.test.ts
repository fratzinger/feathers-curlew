import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from 'feathers-curlew'
import { capture } from '../../../test/helpers'

// A paginated service with a Feathers custom method, plus a nested and a
// hyphenated path — both of which the old service-first tree could not reach
// as named commands.
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
    { methods: ['find', 'get', 'create', 'patch', 'remove', 'summarize'] },
  )
  app.use('api/v1/orders', new MemoryService({ multi: true, paginate: false }))
  app.use('user-settings', new MemoryService({ multi: true, paginate: false }))
  // A service named like one of curlew's own commands — impossible to address
  // before the grammar put the service in argument position.
  app.use('services', new MemoryService({ multi: true, paginate: false }))
  // A service that genuinely implements only `find`.
  app.use(
    'readonly',
    {
      async find() {
        return [{ ok: true }]
      },
    } as any,
    {
      methods: ['find'],
    },
  )
  app.configure(curlew())
  await app.setup()
  for (const title of ['a', 'b', 'c', 'd', 'e'])
    await app.service('things').create({ title })
  await app.service('api/v1/orders').create({ ref: 'o-1' })
  await app.service('user-settings').create({ theme: 'dark' })
  await app.service('services').create({ label: 'tricky' })
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

describe('verb commands', () => {
  it('find takes the service as its first argument', async () => {
    const found = (await run(['find', 'things'])).json()
    expect(found.data).toHaveLength(2) // paginated: default 2
    expect(found.total).toBe(5)
  })

  it('get reads service then id', async () => {
    const record = (await run(['get', 'things', '0'])).json()
    expect(record.title).toBe('a')
  })

  it('create accepts -d and returns the record', async () => {
    const created = (
      await run(['create', 'things', '-d', '{"title":"z"}'])
    ).json()
    expect(created.title).toBe('z')
    await run(['remove', 'things', String(created.id)])
  })

  it('patch takes service then id then data', async () => {
    const patched = (
      await run(['patch', 'things', '1', '-d', '{"title":"B"}'])
    ).json()
    expect(patched.title).toBe('B')
    await run(['patch', 'things', '1', '-d', '{"title":"b"}'])
  })

  it('count returns a bare number', async () => {
    expect((await run(['count', 'things'])).json()).toBe(5)
  })

  it('findAll disables pagination', async () => {
    const all = (await run(['findAll', 'things'])).json()
    expect(Array.isArray(all)).toBe(true)
    expect(all).toHaveLength(5)
  })

  it('findOne returns one record or null', async () => {
    expect(
      (await run(['findOne', 'things', '-q', '{"title":"c"}'])).json().title,
    ).toBe('c')
    expect(
      (await run(['findOne', 'things', '-q', '{"title":"zz"}'])).json(),
    ).toBeNull()
  })

  it('exists checks by id without erroring on a miss', async () => {
    expect((await run(['exists', 'things', '0'])).json()).toEqual({
      exists: true,
    })
    expect((await run(['exists', 'things', '999'])).json()).toEqual({
      exists: false,
    })
  })
})

describe('service paths the old grammar could not name', () => {
  it('reaches a nested (slash) path', async () => {
    const found = (await run(['findAll', 'api/v1/orders'])).json()
    expect(found[0].ref).toBe('o-1')
  })

  it('reaches a hyphenated path', async () => {
    const found = (await run(['findAll', 'user-settings'])).json()
    expect(found[0].theme).toBe('dark')
  })

  it('reaches a service whose name is also a curlew command', async () => {
    // `curlew services` still lists services; `curlew find services` queries the
    // service called "services".
    const found = (await run(['findAll', 'services'])).json()
    expect(found[0].label).toBe('tricky')
    expect((await run(['services'])).json()).toContain('services')
  })
})

describe('methods a service does not have', () => {
  it('fails with E_UNKNOWN_METHOD rather than a TypeError', async () => {
    // Every verb accepts every path now, so a genuinely absent method has to be
    // caught at call time instead of by the shape of the command tree.
    const result = await run(['get', 'readonly', '0'])
    expect(result.code).toBe(1)
    expect(result.errorJson().error.code).toBe('E_UNKNOWN_METHOD')
    expect(result.errorJson().error.message).toContain('"get"')
  })

  it('still calls a method the service has but does not expose externally', async () => {
    // `things` declares methods without `update`, yet MemoryService implements
    // it. curlew calls are internal, so the external allowlist does not gate
    // them — a deliberate change from the old per-service command tree, which
    // generated sub-commands from getServiceOptions().methods.
    const updated = (
      await run(['update', 'things', '0', '-d', '{"title":"replaced"}'])
    ).json()
    expect(updated.title).toBe('replaced')
    await run(['update', 'things', '0', '-d', '{"title":"a"}'])
  })
})
