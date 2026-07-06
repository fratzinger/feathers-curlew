import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from '../src'
import { capture } from './helpers'

let app: any

beforeEach(async () => {
  app = feathers()
  app.use('tasks', new MemoryService({ multi: true, paginate: false }))
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
    return { code, json: () => JSON.parse(cap.stdout().trim()) }
  } finally {
    cap.restore()
  }
}

describe('multi operations', () => {
  it('create accepts an array (multi create)', async () => {
    const { code, json } = await run([
      'tasks',
      'create',
      '--data',
      '[{"t":"a"},{"t":"b"}]',
    ])
    expect(code).toBe(0)
    const created = json()
    expect(Array.isArray(created)).toBe(true)
    expect(created).toHaveLength(2)
  })

  it('patch null patches every matching record', async () => {
    await app.service('tasks').create([
      { t: 'a', done: false },
      { t: 'b', done: false },
      { t: 'c', done: true },
    ])
    const { code, json } = await run([
      'tasks',
      'patch',
      'null',
      '--data',
      '{"done":true}',
      '--query',
      '{"done":false}',
    ])
    expect(code).toBe(0)
    const patched = json()
    expect(Array.isArray(patched)).toBe(true)
    expect(patched).toHaveLength(2)
    expect(patched.every((r: any) => r.done === true)).toBe(true)
  })

  it('remove null removes every matching record', async () => {
    await app.service('tasks').create([
      { t: 'a', keep: false },
      { t: 'b', keep: false },
      { t: 'c', keep: true },
    ])
    const { code, json } = await run([
      'tasks',
      'remove',
      'null',
      '--query',
      '{"keep":false}',
    ])
    expect(code).toBe(0)
    expect(json()).toHaveLength(2)

    const remaining = await app.service('tasks').find({})
    expect(remaining).toHaveLength(1)
  })

  it('remove null also works through the generic service command', async () => {
    await app.service('tasks').create([{ t: 'a' }, { t: 'b' }])
    const { code, json } = await run(['service', 'tasks', 'remove', 'null'])
    expect(code).toBe(0)
    expect(json()).toHaveLength(2)
  })
})
