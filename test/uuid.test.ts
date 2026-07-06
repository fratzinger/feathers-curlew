import { randomUUID } from 'node:crypto'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from '../src'
import { capture } from './helpers'

let app: any
let id: string

beforeEach(async () => {
  app = feathers()
  app.use('docs', new MemoryService({ multi: true, paginate: false }))
  app.configure(curlew())
  await app.setup()
  id = randomUUID()
  await app.service('docs').create({ id, title: 'hello' })
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

describe('uuid ids', () => {
  it('gets a record by uuid (id is not coerced to a number)', async () => {
    const { code, json } = await run(['docs', 'get', id])
    expect(code).toBe(0)
    expect(json().id).toBe(id)
    expect(json().title).toBe('hello')
  })

  it('patches a record by uuid', async () => {
    const { code, json } = await run([
      'docs',
      'patch',
      id,
      '--data',
      '{"title":"updated"}',
    ])
    expect(code).toBe(0)
    expect(json().id).toBe(id)
    expect(json().title).toBe('updated')
  })

  it('removes a record by uuid', async () => {
    const { code, json } = await run(['docs', 'remove', id])
    expect(code).toBe(0)
    expect(json().id).toBe(id)
    expect(await app.service('docs').find({})).toHaveLength(0)
  })

  it('finds a record by uuid via a query', async () => {
    const { json } = await run(['docs', 'find', '--query', `{"id":"${id}"}`])
    const result = json()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(id)
  })
})
