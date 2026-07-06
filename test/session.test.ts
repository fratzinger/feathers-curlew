import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication'
import {
  hooks as localAuthHooks,
  LocalStrategy,
} from '@feathersjs/authentication-local'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from '../src'
import { capture } from './helpers'

const { hashPassword, protect } = localAuthHooks

function makeAuthApp(): any {
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
    before: { create: [hashPassword('password')] },
    after: { all: [protect('password')] },
  })
  app.configure(curlew())
  return app
}

let app: any

beforeAll(async () => {
  app = makeAuthApp()
  await app.setup()
})

afterAll(async () => {
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

describe('whoami (in-process)', () => {
  it('resolves the user from --as', async () => {
    const user = await app
      .service('users')
      .create({ email: 'as@b.c', password: 'pw' })
    const { code, json } = await run(['whoami', '--as', String(user.id)])
    expect(code).toBe(0)
    expect(json().email).toBe('as@b.c')
  })

  it('resolves the user from --token (jwt)', async () => {
    await app.service('users').create({ email: 'tok@b.c', password: 'pw' })
    const auth = (
      await run(['authenticate', '--email', 'tok@b.c', '--password', 'pw'])
    ).json()
    const { json } = await run(['whoami', '--token', auth.accessToken])
    expect(json().email).toBe('tok@b.c')
  })

  it('is null for a plain internal call', async () => {
    expect((await run(['whoami'])).json()).toBeNull()
  })
})

describe('logout (in-process)', () => {
  it('is a no-op that reports the mode', async () => {
    const { code, json } = await run(['logout'])
    expect(code).toBe(0)
    expect(json()).toEqual({ loggedOut: true, mode: 'in-process' })
  })
})
