import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from 'feathers-curlew'
import { capture } from '../../../test/helpers'

let app: any

async function boot(confirmBulk = false) {
  app = feathers()
  app.use('tasks', new MemoryService({ multi: true, paginate: false }))
  app.configure(curlew({ confirmBulk }))
  await app.setup()
  for (const t of ['a', 'b', 'c'])
    await app.service('tasks').create({ t, done: false })
  await app.service('tasks').create({ t: 'd', done: true })
}

afterEach(async () => {
  await app?.teardown?.()
  app = undefined
})

async function run(argv: string[]) {
  const cap = capture()
  try {
    const code = await runCurlew(app, { argv, setup: false, teardown: false })
    return {
      code,
      out: cap.stdout(),
      json: () => JSON.parse(cap.stdout().trim()),
      errorJson: () => cap.errorJson(),
    }
  } finally {
    cap.restore()
  }
}

const remaining = () => app.service('tasks').find({ paginate: false })

describe('--dry-run', () => {
  beforeEach(() => boot())

  it('reports what a bulk remove would hit, and changes nothing', async () => {
    const report = (
      await run([
        'remove',
        'tasks',
        'null',
        '-q',
        '{"done":false}',
        '--dry-run',
      ])
    ).json()
    expect(report).toMatchObject({
      dryRun: true,
      method: 'remove',
      service: 'tasks',
      wouldAffect: 3,
    })
    expect(report.sample).toHaveLength(3)
    expect(await remaining()).toHaveLength(4) // nothing removed
  })

  it('reports a bulk patch the same way', async () => {
    const report = (
      await run([
        'patch',
        'tasks',
        'null',
        '-q',
        '{"done":true}',
        '-d',
        '{"t":"x"}',
        '--dry-run',
      ])
    ).json()
    expect(report.wouldAffect).toBe(1)
    expect(report.sample[0].t).toBe('d')
    expect((await remaining()).map((r: any) => r.t)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('reports a single addressed record', async () => {
    const report = (await run(['remove', 'tasks', '0', '--dry-run'])).json()
    expect(report.wouldAffect).toBe(1)
    expect(report.sample[0].t).toBe('a')
    expect(await remaining()).toHaveLength(4)
  })

  it('reports 0 for an id that does not exist, instead of erroring', async () => {
    const report = (await run(['remove', 'tasks', '9999', '--dry-run'])).json()
    expect(report).toMatchObject({ wouldAffect: 0, sample: [] })
  })

  it('counts a multi-create from the body', async () => {
    const report = (
      await run(['create', 'tasks', '-d', '[{"t":"x"},{"t":"y"}]', '--dry-run'])
    ).json()
    expect(report.wouldAffect).toBe(2)
    expect(await remaining()).toHaveLength(4)
  })

  it('works through `call` too', async () => {
    const report = (
      await run(['call', 'tasks', 'remove', 'null', '-q', '{}', '--dry-run'])
    ).json()
    expect(report.wouldAffect).toBe(4)
    expect(await remaining()).toHaveLength(4)
  })

  it('is ignored by read methods', async () => {
    const found = (await run(['findAll', 'tasks', '--dry-run'])).json()
    expect(Array.isArray(found)).toBe(true)
    expect(found).toHaveLength(4)
  })
})

describe('confirmBulk', () => {
  it('lets bulk writes through while it is off', async () => {
    await boot(false)
    expect((await run(['remove', 'tasks', 'null', '-q', '{}'])).code).toBe(0)
    expect(await remaining()).toHaveLength(0)
  })

  it('blocks an unconfirmed bulk write when it is on', async () => {
    await boot(true)
    const result = await run(['remove', 'tasks', 'null', '-q', '{}'])
    expect(result.code).toBe(1)
    expect(result.errorJson().error.code).toBe('E_BULK_CONFIRM')
    expect(await remaining()).toHaveLength(4) // nothing removed
  })

  it('lets --yes through', async () => {
    await boot(true)
    expect(
      (await run(['remove', 'tasks', 'null', '-q', '{}', '--yes'])).code,
    ).toBe(0)
    expect(await remaining()).toHaveLength(0)
  })

  it('still allows --dry-run without --yes', async () => {
    await boot(true)
    const result = await run([
      'remove',
      'tasks',
      'null',
      '-q',
      '{}',
      '--dry-run',
    ])
    expect(result.code).toBe(0)
    expect(result.json().wouldAffect).toBe(4)
  })

  it('never blocks a single-record write', async () => {
    await boot(true)
    expect((await run(['remove', 'tasks', '0'])).code).toBe(0)
    expect(await remaining()).toHaveLength(3)
  })

  it('guards `call` as well', async () => {
    await boot(true)
    const result = await run(['call', 'tasks', 'remove', 'null', '-q', '{}'])
    expect(result.code).toBe(1)
    expect(result.errorJson().error.code).toBe('E_BULK_CONFIRM')
  })
})

describe('--ndjson', () => {
  beforeEach(() => boot())

  const lines = (out: string) =>
    out
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))

  it('writes one line per record instead of one array', async () => {
    const { out } = await run(['findAll', 'tasks', '--ndjson'])
    expect(lines(out)).toHaveLength(4)
    expect(lines(out)[0].t).toBe('a')
    expect(out.startsWith('[')).toBe(false)
  })

  it('pages through with --page-size, one line per record', async () => {
    const { out } = await run([
      'findAll',
      'tasks',
      '--ndjson',
      '--page-size',
      '2',
    ])
    expect(lines(out).map((r) => r.t)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('honors the query while streaming', async () => {
    const { out } = await run([
      'findAll',
      'tasks',
      '--ndjson',
      '-q',
      '{"done":false}',
    ])
    expect(lines(out).map((r) => r.t)).toEqual(['a', 'b', 'c'])
  })

  it('unwraps a paginated page', async () => {
    const { out } = await run(['find', 'tasks', '--ndjson'])
    expect(lines(out)).toHaveLength(4)
  })

  it('leaves a single record and a bare number alone', async () => {
    expect((await run(['get', 'tasks', '0', '--ndjson'])).json().t).toBe('a')
    expect((await run(['count', 'tasks', '--ndjson'])).json()).toBe(4)
  })
})
