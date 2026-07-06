import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from '../src'
import { capture } from './helpers'

// camelCase service name + a camelCase custom method.
class UserNotes extends MemoryService {
  async markAsRead(data: any, _params: any) {
    return { markedAsRead: true, noteId: data?.noteId ?? null }
  }
}

let app: any

beforeEach(async () => {
  app = feathers()
  app.use('userNotes', new UserNotes({ multi: true, paginate: false }), {
    methods: ['find', 'get', 'create', 'patch', 'remove', 'markAsRead'],
  })
  app.configure(curlew())
  await app.setup()
  await app.service('userNotes').create([
    { firstName: 'Ada', lastName: 'Lovelace', createdAt: 2, isAdmin: true },
    { firstName: 'Alan', lastName: 'Turing', createdAt: 1, isAdmin: false },
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

describe('camelCase handling', () => {
  it('exposes a camelCase service as a named command', async () => {
    const found = (await run(['userNotes', 'find'])).json()
    expect(Array.isArray(found)).toBe(true)
    expect(found).toHaveLength(2)
  })

  it('preserves camelCase (and boolean) properties on create', async () => {
    const created = (
      await run([
        'userNotes',
        'create',
        '--data',
        '{"firstName":"Grace","lastName":"Hopper","isAdmin":true}',
      ])
    ).json()
    expect(created.firstName).toBe('Grace')
    expect(created.lastName).toBe('Hopper')
    expect(created.isAdmin).toBe(true)
  })

  it('filters by a camelCase field via --query', async () => {
    const result = (
      await run(['userNotes', 'find', '--query', '{"firstName":"Ada"}'])
    ).json()
    expect(result).toHaveLength(1)
    expect(result[0].lastName).toBe('Lovelace')
  })

  it('--select keeps camelCase field names', async () => {
    const first = (
      await run([
        'userNotes',
        'find',
        '--select',
        'firstName,lastName',
        '--limit',
        '1',
      ])
    ).json()[0]
    expect(first.firstName).toBeDefined()
    expect(first.lastName).toBeDefined()
    expect(first.createdAt).toBeUndefined()
  })

  it('--sort sorts by a camelCase field', async () => {
    const first = (
      await run(['userNotes', 'find', '--sort', 'createdAt:desc'])
    ).json()[0]
    expect(first.firstName).toBe('Ada') // createdAt: 2
  })

  it('patches a camelCase property', async () => {
    const created = (
      await run(['userNotes', 'create', '--data', '{"firstName":"Edsger"}'])
    ).json()
    const patched = (
      await run([
        'userNotes',
        'patch',
        String(created.id),
        '--data',
        '{"lastName":"Dijkstra"}',
      ])
    ).json()
    expect(patched.lastName).toBe('Dijkstra')
  })

  it('calls a camelCase custom method with camelCase data', async () => {
    const result = (
      await run([
        'service',
        'userNotes',
        'markAsRead',
        '--data',
        '{"noteId":"n-1"}',
      ])
    ).json()
    expect(result).toEqual({ markedAsRead: true, noteId: 'n-1' })
  })

  it('lists the camelCase custom method in describe', async () => {
    const { methods } = (await run(['describe', 'userNotes'])).json()
    expect(methods).toContain('markAsRead')
  })
})
