import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { curlew, defineCurlewCommand, runCurlew } from '../src'
import { capture } from './helpers'

class Orders extends MemoryService {
  async fulfill(_data: any, _params: any) {
    return { ok: true }
  }
}

let app: any

beforeEach(async () => {
  app = feathers()
  app.use('things', new MemoryService({ paginate: false }))
  app.use('orders', new Orders({ paginate: false }), {
    methods: ['find', 'get', 'create', 'fulfill'],
  })
  app.configure(
    curlew({
      commands: [
        defineCurlewCommand({
          name: 'sql',
          description: 'Run raw SQL',
          run: () => ({}),
        }),
      ],
    }),
  )
  await app.setup()
})

afterEach(async () => {
  await app.teardown?.()
})

async function run(argv: string[]) {
  const cap = capture()
  try {
    const code = await runCurlew(app, { argv, setup: false, teardown: false })
    return { code, out: cap.stdout() }
  } finally {
    cap.restore()
  }
}

describe('instructions', () => {
  it('generates a tailored agent block wrapped in managed markers', async () => {
    const { code, out } = await run(['instructions'])
    expect(code).toBe(0)
    expect(out).toContain('## Driving this FeathersJS server')
    expect(out).toContain('internal/root by default')
    expect(out).toContain('### Services')
    // standard-CRUD services are grouped compactly (not one line each)
    expect(out).toContain('**Standard CRUD**')
    expect(out).toContain('things')
    // services with custom/restricted methods are detailed
    expect(out).toContain('**Custom or restricted methods:**')
    expect(out).toContain('orders')
    expect(out).toContain('fulfill')
    expect(out).toContain('### Custom commands')
    expect(out).toContain('curlew sql')
    expect(out).toContain('curlew waitUntil')
    expect(out).toContain('<!-- curlew:instructions:start -->')
    expect(out).toContain('<!-- curlew:instructions:end -->')
  })

  it('emits a SKILL.md with frontmatter for --format skill', async () => {
    const { code, out } = await run(['instructions', '--format', 'skill'])
    expect(code).toBe(0)
    expect(out.startsWith('---\nname: curlew\n')).toBe(true)
    expect(out).toContain('description: Drive this FeathersJS server')
    expect(out).toContain('## Driving this FeathersJS server')
  })
})

describe('instructions --out', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'curlew-instr-'))
  })

  it('writes an idempotent managed block, preserving other content', async () => {
    const file = join(dir, 'AGENTS.md')
    writeFileSync(file, '# My Project\n\nExisting content.\n')

    await run(['instructions', '--out', file])
    const first = readFileSync(file, 'utf8')
    expect(first).toContain('# My Project')
    expect(first).toContain('Existing content.')
    expect(first).toContain('### Services')

    // Re-run: the block is replaced in place, never duplicated.
    await run(['instructions', '--out', file])
    const second = readFileSync(file, 'utf8')
    expect(second.match(/curlew:instructions:start/g)?.length).toBe(1)
    expect(second).toContain('# My Project')
    expect(second).toContain('Existing content.')
  })

  it('overwrites the file for --format skill', async () => {
    const file = join(dir, 'SKILL.md')
    await run(['instructions', '--format', 'skill', '--out', file])
    const content = readFileSync(file, 'utf8')
    expect(content.startsWith('---\nname: curlew')).toBe(true)
    expect(content).toContain('## Driving this FeathersJS server')
  })
})
