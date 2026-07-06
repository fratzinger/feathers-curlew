import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from '../src'
import { capture } from './helpers'

let app: any
let dir: string

beforeEach(async () => {
  app = feathers()
  app.use('notes', new MemoryService({ multi: true, paginate: false }))
  app.configure(curlew())
  await app.setup()
  dir = mkdtempSync(join(tmpdir(), 'curlew-input-'))
})

afterEach(async () => {
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

describe('@file input', () => {
  it('reads --data from a @file', async () => {
    const file = join(dir, 'note.json')
    writeFileSync(file, '{"title":"from file","tag":"x"}')
    const created = (
      await run(['notes', 'create', '--data', `@${file}`])
    ).json()
    expect(created.title).toBe('from file')
    expect(created.tag).toBe('x')
  })

  it('reads --query from a @file', async () => {
    await app.service('notes').create([
      { title: 'a', active: true },
      { title: 'b', active: false },
    ])
    const file = join(dir, 'q.json')
    writeFileSync(file, '{"active":true}')
    const result = (await run(['notes', 'find', '--query', `@${file}`])).json()
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('a')
  })

  it('errors clearly when the file is missing', async () => {
    const { code, errorJson } = await run([
      'notes',
      'create',
      '--data',
      '@/does/not/exist.json',
    ])
    expect(code).toBe(1)
    expect(errorJson().error.code).toBe('E_INPUT_READ')
  })
})
