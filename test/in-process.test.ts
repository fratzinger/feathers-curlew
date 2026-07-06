import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication'
import {
  hooks as localAuthHooks,
  LocalStrategy,
} from '@feathersjs/authentication-local'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { curlew, defineCurlewCommand, runCurlew } from '../src'
import { capture } from './helpers'

const { hashPassword, protect } = localAuthHooks

interface TestApp {
  app: any
  seenParams: any[]
}

function makeApp(): TestApp {
  const seenParams: any[] = []
  const app: any = feathers()

  app.set('authentication', {
    secret: 'test-secret',
    entity: 'user',
    service: 'users',
    authStrategies: ['jwt', 'local'],
    local: { usernameField: 'email', passwordField: 'password' },
  })

  app.use('users', new MemoryService({ multi: true, paginate: false }))

  const authentication = new AuthenticationService(app)
  authentication.register('jwt', new JWTStrategy())
  authentication.register('local', new LocalStrategy())
  app.use('authentication', authentication)

  app.service('users').hooks({
    before: {
      all: [
        (context: any) => {
          seenParams.push(context.params)
          return context
        },
      ],
      create: [hashPassword('password')],
    },
    after: {
      all: [protect('password')],
    },
  })

  app.configure(
    curlew({
      commands: [
        defineCurlewCommand({
          name: 'ping',
          description: 'Echo back through the app',
          args: { msg: { type: 'positional', required: false } },
          run: ({ args, app: injected }) => ({
            pong: true,
            msg: args.msg ?? null,
            hasApp: !!injected,
          }),
        }),
      ],
    }),
  )

  return { app, seenParams }
}

/** Run a curlew command against a shared, already-set-up app. */
async function run(app: any, argv: string[]) {
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

describe('in-process client', () => {
  let ctx: TestApp

  beforeAll(async () => {
    ctx = makeApp()
    await ctx.app.setup()
  })

  afterAll(async () => {
    await ctx.app.teardown?.()
  })

  it('creates a user (hashes the password; internal calls still see it)', async () => {
    const { code, json } = await run(ctx.app, [
      'users',
      'create',
      '--data',
      '{"email":"a@b.c","password":"secret"}',
    ])
    expect(code).toBe(0)
    const user = json()
    expect(user.email).toBe('a@b.c')
    expect(user.id).toBeDefined()
    expect(user.password).not.toBe('secret')
  })

  it('protect() strips the password on external (--as) calls', async () => {
    const created = await ctx.app
      .service('users')
      .create({ email: 'ext@b.c', password: 'pw' })
    const { code, json } = await run(ctx.app, [
      'users',
      'get',
      String(created.id),
      '--as',
      String(created.id),
    ])
    expect(code).toBe(0)
    expect(json().email).toBe('ext@b.c')
    expect(json().password).toBeUndefined()
  })

  it('finds users with a query via the named command', async () => {
    await ctx.app.service('users').create({ email: 'find@b.c', password: 'pw' })
    const { code, json } = await run(ctx.app, [
      'users',
      'find',
      '--query',
      '{"email":"find@b.c"}',
    ])
    expect(code).toBe(0)
    const result = json()
    expect(Array.isArray(result)).toBe(true)
    expect(result[0].email).toBe('find@b.c')
  })

  it('works through the generic service passthrough', async () => {
    const { code, json } = await run(ctx.app, ['service', 'users', 'find'])
    expect(code).toBe(0)
    expect(Array.isArray(json())).toBe(true)
  })

  it('lists services', async () => {
    const { json } = await run(ctx.app, ['services'])
    const services = json()
    expect(services).toContain('users')
    expect(services).toContain('authentication')
  })

  it('authenticates and returns an accessToken', async () => {
    await ctx.app.service('users').create({ email: 'auth@b.c', password: 'pw' })
    const { code, json } = await run(ctx.app, [
      'authenticate',
      '--email',
      'auth@b.c',
      '--password',
      'pw',
    ])
    expect(code).toBe(0)
    expect(json().accessToken).toBeTruthy()
  })

  it('authenticates from a full --data payload', async () => {
    await ctx.app.service('users').create({ email: 'data@b.c', password: 'pw' })
    const { code, json } = await run(ctx.app, [
      'authenticate',
      '--data',
      '{"email":"data@b.c","password":"pw"}',
    ])
    expect(code).toBe(0)
    expect(json().accessToken).toBeTruthy()
  })

  it('authenticates with the jwt strategy', async () => {
    await ctx.app
      .service('users')
      .create({ email: 'jwtstrat@b.c', password: 'pw' })
    const local = (
      await run(ctx.app, [
        'authenticate',
        '--email',
        'jwtstrat@b.c',
        '--password',
        'pw',
      ])
    ).json()
    const { code, json } = await run(ctx.app, [
      'authenticate',
      '--strategy',
      'jwt',
      '--data',
      `{"accessToken":"${local.accessToken}"}`,
    ])
    expect(code).toBe(0)
    expect(json().accessToken).toBeTruthy()
    expect(json().user?.email).toBe('jwtstrat@b.c')
  })

  it('runs a custom command with app access', async () => {
    const { code, json } = await run(ctx.app, ['ping', 'hello'])
    expect(code).toBe(0)
    expect(json()).toEqual({ pong: true, msg: 'hello', hasApp: true })
  })

  it('defaults to an internal call (no provider)', async () => {
    ctx.seenParams.length = 0
    await run(ctx.app, ['users', 'find'])
    expect(ctx.seenParams.at(-1)?.provider).toBeUndefined()
  })

  it('--as sets provider and loads the user', async () => {
    const user = await ctx.app
      .service('users')
      .create({ email: 'as@b.c', password: 'pw' })
    ctx.seenParams.length = 0
    const { code } = await run(ctx.app, [
      'users',
      'find',
      '--as',
      String(user.id),
    ])
    expect(code).toBe(0)
    const params = ctx.seenParams.at(-1)
    expect(params?.provider).toBe('curlew')
    expect(params?.user?.id).toBe(user.id)
  })

  it('--params merges arbitrary extra params into the call', async () => {
    ctx.seenParams.length = 0
    await run(ctx.app, [
      'users',
      'find',
      '--params',
      '{"tenantId":"acme","flag":true}',
    ])
    const params = ctx.seenParams.at(-1)
    expect(params?.tenantId).toBe('acme')
    expect(params?.flag).toBe(true)
  })

  it('curlew flags win over --params on conflicting keys', async () => {
    const user = await ctx.app
      .service('users')
      .create({ email: 'pm@b.c', password: 'pw' })
    ctx.seenParams.length = 0
    await run(ctx.app, [
      'users',
      'find',
      '--as',
      String(user.id),
      '--params',
      '{"provider":"forged","tenantId":"t1"}',
    ])
    const params = ctx.seenParams.at(-1)
    expect(params?.provider).toBe('curlew') // --as wins over --params.provider
    expect(params?.tenantId).toBe('t1') // extra param is still merged
  })

  it('returns exit 1 and a structured JSON error on failure', async () => {
    const { code, errorJson } = await run(ctx.app, ['users', 'get', '999999'])
    expect(code).toBe(1)
    const parsed = errorJson()
    expect(parsed.error.code).toBe(404)
    expect(parsed.error.name).toBe('NotFound')
  })
})
