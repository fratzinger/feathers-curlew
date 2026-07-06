import { describe, expect, it } from 'vitest'
import { buildParams, coerceId } from '../src/params'
import { resolvedOptions } from './helpers'

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

describe('coerceId', () => {
  it('coerces integer-looking ids to numbers', () => {
    expect(coerceId('42')).toBe(42)
  })
  it('leaves non-numeric ids as strings', () => {
    expect(coerceId('a1b2')).toBe('a1b2')
  })
  it('leaves a uuid as a string', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    expect(coerceId(uuid)).toBe(uuid)
  })
  it('maps the literal "null" to JS null (bulk operations)', () => {
    expect(coerceId('null')).toBeNull()
  })
})

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
