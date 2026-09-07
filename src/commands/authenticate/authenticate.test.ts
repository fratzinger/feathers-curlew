import type { CurlewOptions } from '../../types'
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication'
import {
  hooks as localAuthHooks,
  LocalStrategy,
} from '@feathersjs/authentication-local'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, describe, expect, it } from 'vitest'
import { curlew, runCurlew } from 'feathers-curlew'
import { capture, fakeClient } from '../../../test/helpers'

const { hashPassword, protect } = localAuthHooks

function makeAuthApp(options: CurlewOptions = {}): any {
  const app: any = feathers()
  app.set('authentication', {
    secret: 'test-secret',
    entity: 'user',
    service: 'users',
    authStrategies: ['jwt', 'local'],
    jwtOptions: { expiresIn: '1d' },
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
  app.configure(curlew(options))
  return app
}

/** The JWT payload, decoded without verifying (the app already signed it). */
function claims(token: string): any {
  return JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
  )
}

let app: any
/** MemoryService hands out ids from 0, so never hard-code one. */
let userId: string

async function boot(options: CurlewOptions = {}) {
  app = makeAuthApp(options)
  await app.setup()
  const user = await app.service('users').create({
    email: 'thomas@mueller.de',
    password: 'secret',
    name: 'Thomas Müller',
  })
  userId = String(user.id)
  return app
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
      stdout: cap.stdout(),
      json: () => JSON.parse(cap.stdout().trim()),
      errorJson: () => cap.errorJson(),
    }
  } finally {
    cap.restore()
  }
}

describe('authenticate', () => {
  it('still authenticates with credentials', async () => {
    await boot({ impersonate: true })
    const result = (
      await run([
        'authenticate',
        '--email',
        'thomas@mueller.de',
        '--password',
        'secret',
      ])
    ).json()
    expect(result.user.email).toBe('thomas@mueller.de')
    expect(claims(result.accessToken).sub).toBe(userId)
  })

  it('--raw prints only the token, unquoted', async () => {
    await boot({ impersonate: true })
    const result = await run(['authenticate', '--as', userId, '--raw'])
    expect(result.stdout.endsWith('\n')).toBe(true)
    const token = result.stdout.trim()
    expect(token.startsWith('eyJ')).toBe(true)
    expect(token).not.toContain('"')
  })
})

// The mint itself is covered in src/impersonate; these guard the command around
// it — the opt-in gate, the in-process requirement, and the flag plumbing.
describe('authenticate --as (impersonation)', () => {
  it('is disabled unless `impersonate` is set', async () => {
    await boot()
    const result = await run(['authenticate', '--as', userId])
    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.errorJson().error.code).toBe('E_IMPERSONATION_DISABLED')
  })

  it('rejects --as against a remote server', async () => {
    const cap = capture()
    try {
      const code = await runCurlew(
        fakeClient({ mode: 'remote', app: undefined }),
        { argv: ['authenticate', '--as', '1'], impersonate: true },
      )
      expect(code).toBe(1)
      expect(cap.errorJson().error.code).toBe('E_REQUIRES_APP')
    } finally {
      cap.restore()
    }
  })

  it('mints a token the jwt strategy accepts, end to end', async () => {
    await boot({ impersonate: true })
    const minted = (await run(['authenticate', '--as', userId])).json()
    const whoami = (await run(['whoami', '--token', minted.accessToken])).json()
    expect(String(whoami.id)).toBe(userId)
  })

  it('passes --expires-in and --payload through to the mint', async () => {
    await boot({ impersonate: true })
    const minted = (
      await run([
        'authenticate',
        '--as',
        userId,
        '--expires-in',
        '60s',
        '--payload',
        '{"scope":"admin"}',
      ])
    ).json()
    const { exp, iat, scope } = claims(minted.accessToken)
    expect(exp - iat).toBe(60)
    expect(scope).toBe('admin')
  })

  it('resolves --as through resolveUser', async () => {
    await boot({
      impersonate: true,
      resolveUser: async ({ app, value }) => {
        const [user] = await app
          .service('users')
          .find({ query: { email: value }, paginate: false })
        return user
      },
    })
    const minted = (
      await run(['authenticate', '--as', 'thomas@mueller.de'])
    ).json()
    expect(String(minted.user.id)).toBe(userId)
  })
})
