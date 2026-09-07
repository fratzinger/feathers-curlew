import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from 'feathers-curlew'
import { capture } from '../../../test/helpers'

class Things extends MemoryService {
  async summarize(data: any, _params: any) {
    return { summarized: true, tag: data?.tag ?? null }
  }
}

let app: any

beforeAll(async () => {
  app = feathers()
  app.use('things', new Things({ multi: true, paginate: false }), {
    methods: ['find', 'get', 'create', 'patch', 'remove', 'summarize'],
  })
  app.use('api/v1/orders', new MemoryService({ multi: true, paginate: false }))
  app.configure(curlew())
  await app.setup()
  await app.service('things').create({ title: 'a' })
  await app.service('api/v1/orders').create({ ref: 'o-1' })
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

describe('call', () => {
  it('calls a Feathers custom method with (data, params)', async () => {
    const result = (
      await run(['call', 'things', 'summarize', '-d', '{"tag":"x"}'])
    ).json()
    expect(result).toEqual({ summarized: true, tag: 'x' })
  })

  it('defaults custom-method data to an empty object', async () => {
    expect((await run(['call', 'things', 'summarize'])).json()).toEqual({
      summarized: true,
      tag: null,
    })
  })

  it('also routes the standard verbs, for a uniform escape hatch', async () => {
    expect((await run(['call', 'things', 'get', '0'])).json().title).toBe('a')
    expect((await run(['call', 'api/v1/orders', 'find'])).json()[0].ref).toBe(
      'o-1',
    )
  })

  it('errors clearly for a method the service does not have', async () => {
    const result = await run(['call', 'things', 'nope'])
    expect(result.code).toBe(1)
    expect(result.errorJson().error.code).toBe('E_UNKNOWN_METHOD')
  })

  it('lists the custom method in describe', async () => {
    expect((await run(['describe', 'things'])).json().methods).toContain(
      'summarize',
    )
  })
})
