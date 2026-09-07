import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from 'feathers-curlew'
import { capture } from '../../test/helpers'

let app: any

beforeAll(async () => {
  app = feathers()
  app.use('items', new MemoryService({ multi: true, paginate: false }))
  app.configure(curlew())
  await app.setup()
  for (const n of [1, 2, 3, 4, 5])
    await app.service('items').create({ n, active: n % 2 === 1 })
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

describe('query convenience flags', () => {
  it('--limit caps the number of results', async () => {
    expect((await run(['find', 'items', '--limit', '2'])).json()).toHaveLength(
      2,
    )
  })

  it('--skip skips results', async () => {
    expect((await run(['find', 'items', '--skip', '3'])).json()).toHaveLength(2)
  })

  it('--sort sorts with the "field:desc" form', async () => {
    expect((await run(['find', 'items', '--sort', 'n:desc'])).json()[0].n).toBe(
      5,
    )
  })

  it('--sort supports the "-field" form (via =)', async () => {
    expect((await run(['find', 'items', '--sort=-n'])).json()[0].n).toBe(5)
  })

  it('--select returns only the selected fields', async () => {
    const first = (
      await run(['find', 'items', '--select', 'n', '--limit', '1'])
    ).json()[0]
    expect(first.n).toBeDefined()
    expect(first.active).toBeUndefined()
  })

  it('merges the flags with an explicit --query', async () => {
    const result = (
      await run(['find', 'items', '--query', '{"active":true}', '--limit', '2'])
    ).json()
    expect(result).toHaveLength(2)
    expect(result.every((x: any) => x.active === true)).toBe(true)
  })

  it('rejects a non-numeric --limit', async () => {
    const { code, errorJson } = await run(['find', 'items', '--limit', 'abc'])
    expect(code).toBe(1)
    expect(errorJson().error.code).toBe('E_INVALID_NUMBER')
  })
})
