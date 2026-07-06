import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from '../src'
import { capture } from './helpers'

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
    expect((await run(['items', 'find', '--limit', '2'])).json()).toHaveLength(
      2,
    )
  })

  it('--skip skips results', async () => {
    expect((await run(['items', 'find', '--skip', '3'])).json()).toHaveLength(2)
  })

  it('--sort sorts with the "field:desc" form', async () => {
    expect((await run(['items', 'find', '--sort', 'n:desc'])).json()[0].n).toBe(
      5,
    )
  })

  it('--sort supports the "-field" form (via =)', async () => {
    expect((await run(['items', 'find', '--sort=-n'])).json()[0].n).toBe(5)
  })

  it('--select returns only the selected fields', async () => {
    const first = (
      await run(['items', 'find', '--select', 'n', '--limit', '1'])
    ).json()[0]
    expect(first.n).toBeDefined()
    expect(first.active).toBeUndefined()
  })

  it('merges the flags with an explicit --query', async () => {
    const result = (
      await run(['items', 'find', '--query', '{"active":true}', '--limit', '2'])
    ).json()
    expect(result).toHaveLength(2)
    expect(result.every((x: any) => x.active === true)).toBe(true)
  })

  it('rejects a non-numeric --limit', async () => {
    const { code, errorJson } = await run(['items', 'find', '--limit', 'abc'])
    expect(code).toBe(1)
    expect(errorJson().error.code).toBe('E_INVALID_NUMBER')
  })
})
