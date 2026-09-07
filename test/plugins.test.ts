import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  curlew,
  defineCurlewCommand,
  defineCurlewPlugin,
  runCurlew,
} from 'feathers-curlew'
import { applyPluginEnv } from '../src/plugins'
import { capture } from './helpers'

describe('applyPluginEnv', () => {
  const KEY = 'CURLEW_TEST_ENV_VAR'
  afterEach(() => {
    delete process.env[KEY]
  })

  it('sets process.env from plugin env hooks', async () => {
    const plugin = defineCurlewPlugin({
      name: 'set-env',
      env: ({ mode }) => ({ [KEY]: mode }),
    })
    await applyPluginEnv([plugin], {
      mode: 'in-process',
      cwd: '/x',
      argv: ['find', 'users'],
    })
    expect(process.env[KEY]).toBe('in-process')
  })

  it('unsets a variable when the value is undefined', async () => {
    process.env[KEY] = 'preset'
    const plugin = defineCurlewPlugin({
      name: 'unset-env',
      env: () => ({ [KEY]: undefined }),
    })
    await applyPluginEnv([plugin], { mode: 'in-process', cwd: '/x', argv: [] })
    expect(process.env[KEY]).toBeUndefined()
  })

  it('runs hooks in order (later wins)', async () => {
    const a = defineCurlewPlugin({ name: 'a', env: () => ({ [KEY]: 'a' }) })
    const b = defineCurlewPlugin({ name: 'b', env: () => ({ [KEY]: 'b' }) })
    await applyPluginEnv([a, b], { mode: 'in-process', cwd: '/x', argv: [] })
    expect(process.env[KEY]).toBe('b')
  })
})

describe('plugin commands', () => {
  let app: any

  beforeEach(async () => {
    app = feathers()
    app.use('items', new MemoryService({ paginate: false }))
    app.configure(
      curlew({
        plugins: [
          defineCurlewPlugin({
            name: 'greet-plugin',
            commands: [
              defineCurlewCommand({
                name: 'greet',
                args: { who: { type: 'positional', required: false } },
                run: ({ args }) => ({ hello: args.who ?? 'world' }),
              }),
            ],
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
      return { code, json: () => JSON.parse(cap.stdout().trim()) }
    } finally {
      cap.restore()
    }
  }

  it('exposes commands contributed by a plugin', async () => {
    const { code, json } = await run(['greet', 'curlew'])
    expect(code).toBe(0)
    expect(json()).toEqual({ hello: 'curlew' })
  })
})
