import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { curlew, runCurlew, waitForEvent } from '../src'
import { capture } from './helpers'

let app: any

beforeEach(async () => {
  app = feathers()
  app.use('orders', new MemoryService({ multi: true, paginate: false }))
  app.configure(curlew())
  await app.setup()
})

afterEach(async () => {
  await app.teardown?.()
})

describe('waitForEvent', () => {
  it('resolves with the first matching event', async () => {
    const pending = waitForEvent(app, 'orders', {
      events: ['created'],
      query: { status: 'paid' },
      timeout: 1000,
    })
    await app.service('orders').create({ status: 'pending' }) // ignored
    await app.service('orders').create({ status: 'paid', total: 200 }) // matches
    const result = await pending
    expect(result.event).toBe('created')
    expect(result.service).toBe('orders')
    expect((result.data as any).status).toBe('paid')
  })

  it('matches with Feathers query operators', async () => {
    const pending = waitForEvent(app, 'orders', {
      query: { total: { $gt: 100 } },
      timeout: 1000,
    })
    await app.service('orders').create({ total: 50 }) // ignored
    await app.service('orders').create({ total: 150 }) // matches
    expect((await pending).data).toMatchObject({ total: 150 })
  })

  it('filters by event type', async () => {
    const created = await app.service('orders').create({ status: 'new' })
    const pending = waitForEvent(app, 'orders', {
      events: ['patched'],
      timeout: 1000,
    })
    await app.service('orders').patch(created.id, { status: 'done' })
    expect((await pending).event).toBe('patched')
  })

  it('rejects with E_TIMEOUT when nothing matches', async () => {
    await expect(
      waitForEvent(app, 'orders', { query: { status: 'never' }, timeout: 100 }),
    ).rejects.toMatchObject({ code: 'E_TIMEOUT' })
  })

  it('removes its listeners after resolving', async () => {
    const before = app.service('orders').listenerCount('created')
    const pending = waitForEvent(app, 'orders', {
      events: ['created'],
      timeout: 1000,
    })
    expect(app.service('orders').listenerCount('created')).toBe(before + 1)
    await app.service('orders').create({ x: 1 })
    await pending
    expect(app.service('orders').listenerCount('created')).toBe(before)
  })
})

describe('waitUntil command', () => {
  it('prints the matching event and exits 0', async () => {
    const cap = capture()
    try {
      const pending = runCurlew(app, {
        argv: [
          'waitUntil',
          'orders',
          'created',
          '--query',
          '{"status":"paid"}',
          '--timeout',
          '2000',
        ],
        setup: false,
        teardown: false,
      })
      setTimeout(
        () => void app.service('orders').create({ status: 'pending' }),
        30,
      )
      setTimeout(
        () => void app.service('orders').create({ status: 'paid', total: 200 }),
        60,
      )
      const code = await pending
      expect(code).toBe(0)
      const result = JSON.parse(cap.stdout().trim())
      expect(result.event).toBe('created')
      expect(result.service).toBe('orders')
      expect(result.data.status).toBe('paid')
    } finally {
      cap.restore()
    }
  })

  it('exits 1 with E_TIMEOUT when nothing matches', async () => {
    const cap = capture()
    try {
      const code = await runCurlew(app, {
        argv: [
          'waitUntil',
          'orders',
          '--query',
          '{"status":"never"}',
          '--timeout',
          '100',
        ],
        setup: false,
        teardown: false,
      })
      expect(code).toBe(1)
      expect(cap.errorJson().error.code).toBe('E_TIMEOUT')
    } finally {
      cap.restore()
    }
  })
})
