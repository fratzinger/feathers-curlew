import type { CurlewOptions } from '../types'
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { afterEach, describe, expect, it } from 'vitest'
import { resolvedOptions } from '../../test/helpers'
import { mintAccessToken } from '.'

/** The JWT payload, decoded without verifying (we just signed it). */
function claims(token: string): any {
  return JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
  )
}

let app: any

async function boot(authConfig: Record<string, unknown> = {}) {
  app = feathers()
  app.set('authentication', {
    secret: 'test-secret',
    entity: 'user',
    service: 'users',
    authStrategies: ['jwt'],
    jwtOptions: { expiresIn: '1d' },
    ...authConfig,
  })
  app.use('users', new MemoryService({ multi: true, paginate: false }))
  const authentication = new AuthenticationService(app)
  authentication.register('jwt', new JWTStrategy())
  app.use('authentication', authentication)
  await app.setup()
  const user = await app
    .service('users')
    .create({ email: 'thomas@mueller.de', name: 'Thomas Müller' })
  return String(user.id)
}

const opts = (extra: CurlewOptions = {}) =>
  resolvedOptions({ impersonate: true, ...extra })

afterEach(async () => {
  await app?.teardown?.()
  app = undefined
})

describe('mintAccessToken', () => {
  it('signs a token the app’s own jwt strategy accepts', async () => {
    const id = await boot()
    const { accessToken } = await mintAccessToken(app, opts(), { as: id })

    // The proof: hand it back to the real strategy.
    const verified = await app
      .service('authentication')
      .create({ strategy: 'jwt', accessToken })
    expect(String(verified.user.id)).toBe(id)
  })

  it('derives the subject from the configured entity service', async () => {
    const id = await boot()
    const { accessToken } = await mintAccessToken(app, opts(), { as: id })
    expect(claims(accessToken).sub).toBe(id)
    // createAccessToken assigns a jti of its own.
    expect(claims(accessToken).jti).toBeTruthy()
  })

  it('returns the user under the configured entity key, plus expiresAt', async () => {
    const id = await boot()
    const result = await mintAccessToken(app, opts(), { as: id })
    expect((result.user as any).email).toBe('thomas@mueller.de')
    expect(result.expiresAt).toBe(
      new Date(claims(result.accessToken).exp * 1000).toISOString(),
    )
  })

  it('honors an entityId override for the subject', async () => {
    const id = await boot({ entityId: 'email' })
    const { accessToken } = await mintAccessToken(app, opts(), { as: id })
    expect(claims(accessToken).sub).toBe('thomas@mueller.de')
  })

  it('still sets a subject when the app has no entity', async () => {
    // With `entity: null` Feathers' getTokenOptions derives no subject, so the
    // token would have no `sub` and the jwt strategy would reject it later.
    const id = await boot({ entity: null })
    const { accessToken } = await mintAccessToken(app, opts(), { as: id })
    expect(claims(accessToken).sub).toBe(id)
  })

  it('lets --expires-in override the app lifetime', async () => {
    const id = await boot()
    const { accessToken } = await mintAccessToken(app, opts(), {
      as: id,
      expiresIn: '60s',
    })
    const { exp, iat } = claims(accessToken)
    expect(exp - iat).toBe(60)
  })

  it('merges extra payload claims', async () => {
    const id = await boot()
    const { accessToken } = await mintAccessToken(app, opts(), {
      as: id,
      payload: { scope: 'admin' },
    })
    expect(claims(accessToken).scope).toBe('admin')
    expect(claims(accessToken).sub).toBe(id) // subject survives the merge
  })

  it('resolves the user through resolveUser', async () => {
    await boot()
    const options = opts({
      resolveUser: async ({ app, value }) => {
        const [user] = await app
          .service('users')
          .find({ query: { email: value }, paginate: false })
        return user
      },
    })
    const result = await mintAccessToken(app, options, {
      as: 'thomas@mueller.de',
    })
    expect((result.user as any).email).toBe('thomas@mueller.de')
    expect(claims(result.accessToken).sub).toBe('0')
  })

  it('lets an impersonate function own the mint entirely', async () => {
    const id = await boot()
    const options = opts({
      impersonate: ({ user, value }) => `custom-${(user as any).id}-${value}`,
    })
    const result = await mintAccessToken(app, options, { as: id })
    expect(result.accessToken).toBe(`custom-${id}-${id}`)
    // The user still comes back, so the output shape matches a real login.
    expect((result.user as any).email).toBe('thomas@mueller.de')
    // Not a JWT, so there is no expiry to report.
    expect(result.expiresAt).toBeUndefined()
  })

  it('fails clearly when authService is not an AuthenticationService', async () => {
    await boot()
    await expect(
      mintAccessToken(app, opts({ authService: 'users' }), { as: '0' }),
    ).rejects.toMatchObject({ code: 'E_NOT_AUTH_SERVICE' })
  })

  it('does not need an auth service when impersonate owns the mint', async () => {
    const id = await boot()
    const options = opts({ authService: 'users', impersonate: () => 'tok' })
    const result = await mintAccessToken(app, options, { as: id })
    expect(result.accessToken).toBe('tok')
  })
})
