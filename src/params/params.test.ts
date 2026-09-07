import { describe, expect, it, vi } from 'vitest'
import { buildParams } from '.'
import { resolvedOptions } from '../../test/helpers'

function fakeApp(): any {
  return {
    service: () => ({
      get: async (id: string | number) => ({ id, email: 'user@example.com' }),
      create: async () => ({
        user: { id: 7, viaToken: true },
        accessToken: 'jwt',
      }),
    }),
  }
}

describe('buildParams', () => {
  it('is internal by default (no provider)', async () => {
    const params = await buildParams(
      fakeApp(),
      { query: { active: true } },
      resolvedOptions(),
    )
    expect(params.provider).toBeUndefined()
    expect(params.query).toEqual({ active: true })
  })

  it('--internal forces internal even in authenticated mode', async () => {
    const params = await buildParams(
      fakeApp(),
      { internal: true },
      resolvedOptions({ permission: 'authenticated' }),
    )
    expect(params.provider).toBeUndefined()
  })

  it('--as loads the user and sets provider', async () => {
    const params = (await buildParams(
      fakeApp(),
      { as: '5' },
      resolvedOptions(),
    )) as any
    expect(params.provider).toBe('curlew')
    expect(params.authenticated).toBe(true)
    expect(params.user.id).toBe(5)
  })

  it('--token resolves the user via the jwt strategy', async () => {
    const params = (await buildParams(
      fakeApp(),
      { token: 'abc' },
      resolvedOptions(),
    )) as any
    expect(params.provider).toBe('curlew')
    expect(params.user.viaToken).toBe(true)
    expect(params.authentication).toEqual({
      strategy: 'jwt',
      accessToken: 'abc',
    })
  })

  it('authenticated mode without credentials throws E_AUTH_REQUIRED', async () => {
    await expect(
      buildParams(
        fakeApp(),
        {},
        resolvedOptions({ permission: 'authenticated' }),
      ),
    ).rejects.toThrow(/Authenticated mode/)
  })
})

describe('resolveActingUser (--as)', () => {
  it('loads the value as an id when no resolveUser is configured', async () => {
    const params = (await buildParams(
      fakeApp(),
      { as: '42' },
      resolvedOptions(),
    )) as any
    // coerceId turned the CLI string into a number on the way to get().
    expect(params.user).toEqual({ id: 42, email: 'user@example.com' })
  })

  it('uses an object returned by resolveUser as-is, without touching userService', async () => {
    const get = vi.fn()
    const app: any = { service: () => ({ get }) }
    const params = (await buildParams(
      app,
      { as: 'thomas@mueller.de' },
      resolvedOptions({
        resolveUser: ({ value }) => ({ id: 7, email: value }),
      }),
    )) as any
    expect(params.user).toEqual({ id: 7, email: 'thomas@mueller.de' })
    expect(get).not.toHaveBeenCalled()
  })

  it('loads an id returned by resolveUser through userService, uncoerced', async () => {
    const get = vi.fn(async (id: unknown) => ({ id, loaded: true }))
    const app: any = { service: () => ({ get }) }
    const params = (await buildParams(
      app,
      { as: 'Thomas Müller' },
      resolvedOptions({ resolveUser: () => '007' }),
    )) as any
    // The author knows their own id type, so '007' must NOT become 7.
    expect(get).toHaveBeenCalledWith('007')
    expect(params.user).toEqual({ id: '007', loaded: true })
  })

  it('passes the raw --as value and the options to resolveUser', async () => {
    const resolveUser = vi.fn(() => ({ id: 1 }))
    const options = resolvedOptions({ resolveUser })
    const app = fakeApp()
    await buildParams(app, { as: 'Thomas Müller' }, options)
    expect(resolveUser).toHaveBeenCalledWith({
      app,
      value: 'Thomas Müller',
      options,
    })
  })

  it('throws E_USER_NOT_FOUND when resolveUser finds nobody', async () => {
    await expect(
      buildParams(
        fakeApp(),
        { as: 'nobody@example.com' },
        resolvedOptions({ resolveUser: () => undefined }),
      ),
    ).rejects.toMatchObject({ code: 'E_USER_NOT_FOUND' })
  })

  it('rejects a JWT before resolveUser ever sees it', async () => {
    const resolveUser = vi.fn(() => ({ id: 1 }))
    await expect(
      buildParams(
        fakeApp(),
        { as: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.c2ln' },
        resolvedOptions({ resolveUser }),
      ),
    ).rejects.toMatchObject({ code: 'E_AS_LOOKS_LIKE_JWT' })
    expect(resolveUser).not.toHaveBeenCalled()
  })

  it('does not mistake a dotted username for a JWT', async () => {
    const resolveUser = vi.fn(() => ({ id: 1, name: 'thomas.mueller.de' }))
    const params = (await buildParams(
      fakeApp(),
      { as: 'thomas.mueller.de' },
      resolvedOptions({ resolveUser }),
    )) as any
    expect(resolveUser).toHaveBeenCalled()
    expect(params.user.name).toBe('thomas.mueller.de')
  })
})
