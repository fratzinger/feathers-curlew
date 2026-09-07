import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from 'feathers-curlew'
import { capture, fakeClient } from '../../../test/helpers'

let app: any

beforeEach(async () => {
  app = feathers()
  app.use('tasks', new MemoryService({ multi: true, paginate: false }))
  app.configure(curlew())
  await app.setup()
})

afterEach(async () => {
  await app?.teardown?.()
})

/** Run `watch` while emitting events on the next ticks. */
async function watching(argv: string[], emit: () => Promise<void>) {
  const cap = capture()
  try {
    const running = runCurlew(app, { argv, setup: false, teardown: false })
    await new Promise((r) => setImmediate(r))
    await emit()
    const code = await running
    return { code, out: cap.stdout(), err: cap.stderr() }
  } finally {
    cap.restore()
  }
}

const lines = (out: string) =>
  out
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))

describe('watch', () => {
  it('streams one NDJSON line per event and stops at --limit', async () => {
    const { code, out } = await watching(
      ['watch', 'tasks', '--limit', '2'],
      async () => {
        await app.service('tasks').create({ t: 'a' })
        await app.service('tasks').create({ t: 'b' })
        await app.service('tasks').create({ t: 'c' }) // after the limit
      },
    )
    expect(code).toBe(0)
    const events = lines(out)
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ event: 'created', service: 'tasks' })
    expect(events.map((e) => e.data.t)).toEqual(['a', 'b'])
  })

  it('filters events with --query', async () => {
    const { out } = await watching(
      ['watch', 'tasks', '--limit', '1', '-q', '{"t":"keep"}'],
      async () => {
        await app.service('tasks').create({ t: 'skip' })
        await app.service('tasks').create({ t: 'keep' })
      },
    )
    expect(lines(out).map((e) => e.data.t)).toEqual(['keep'])
  })

  it('listens for one named event only', async () => {
    const { out } = await watching(
      ['watch', 'tasks', 'patched', '--limit', '1'],
      async () => {
        const created = await app.service('tasks').create({ t: 'a' })
        await app.service('tasks').patch(created.id, { t: 'b' })
      },
    )
    const events = lines(out)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('patched')
  })

  it('stops on --timeout with nothing to report', async () => {
    const cap = capture()
    try {
      const code = await runCurlew(app, {
        argv: ['watch', 'tasks', '--timeout', '20'],
        setup: false,
        teardown: false,
      })
      expect(code).toBe(0)
      expect(cap.stdout()).toBe('')
    } finally {
      cap.restore()
    }
  })

  it('is unavailable in remote mode', async () => {
    const cap = capture()
    try {
      const code = await runCurlew(fakeClient({ mode: 'remote' }), {
        argv: ['watch', 'tasks'],
      })
      expect(code).toBe(1)
      expect(cap.errorJson().error.code).toBe('E_REQUIRES_APP')
    } finally {
      cap.restore()
    }
  })
})

describe('a custom matcher', () => {
  it('replaces sift for --query matching', async () => {
    // A matcher that only ever matches `t` by prefix — sift would not.
    app = feathers()
    app.use('tasks', new MemoryService({ multi: true, paginate: false }))
    app.configure(
      curlew({
        matcher: (query: any) => (data: any) =>
          typeof query.t === 'string' && String(data?.t).startsWith(query.t),
      }),
    )
    await app.setup()

    const { out } = await watching(
      ['watch', 'tasks', '--limit', '1', '-q', '{"t":"pre"}'],
      async () => {
        await app.service('tasks').create({ t: 'nope' })
        await app.service('tasks').create({ t: 'prefixed' })
      },
    )
    expect(lines(out).map((e) => e.data.t)).toEqual(['prefixed'])
  })

  it('is used by waitUntil too', async () => {
    app = feathers()
    app.use('tasks', new MemoryService({ multi: true, paginate: false }))
    app.configure(curlew({ matcher: () => () => false })) // matches nothing
    await app.setup()

    const cap = capture()
    try {
      const running = runCurlew(app, {
        argv: ['waitUntil', 'tasks', '--query', '{"t":"a"}', '--timeout', '40'],
        setup: false,
        teardown: false,
      })
      await new Promise((r) => setImmediate(r))
      await app.service('tasks').create({ t: 'a' }) // sift would match this
      expect(await running).toBe(1)
      expect(cap.errorJson().error.code).toBe('E_TIMEOUT')
    } finally {
      cap.restore()
    }
  })
})
