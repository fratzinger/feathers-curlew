/**
 * Read the `exp` claim out of a JWT as an ISO timestamp.
 *
 * Decodes the payload segment only — no signature check, so this is for tokens
 * we just signed ourselves, never for trusting one we received. Anything that
 * isn't a JWT carrying a numeric `exp` yields `undefined` rather than throwing.
 */
export function expiresAt(token: string): string | undefined {
  try {
    const segments = token.split('.')
    if (segments.length !== 3) return undefined
    const payload = segments[1]
    if (!payload) return undefined
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { exp?: unknown }
    return typeof claims.exp === 'number'
      ? new Date(claims.exp * 1000).toISOString()
      : undefined
  } catch {
    return undefined
  }
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  const token = (claims: unknown, segments = 3): string =>
    [
      'eyJhbGciOiJIUzI1NiJ9',
      Buffer.from(JSON.stringify(claims)).toString('base64url'),
      'sig',
    ]
      .slice(0, segments)
      .join('.')

  describe('expiresAt', () => {
    it('turns a numeric exp into an ISO timestamp', () => {
      expect(expiresAt(token({ sub: '1', exp: 1_700_000_000 }))).toBe(
        '2023-11-14T22:13:20.000Z',
      )
    })

    it('returns undefined for a token without exp', () => {
      expect(expiresAt(token({ sub: '1' }))).toBeUndefined()
    })

    it('ignores a non-numeric exp', () => {
      expect(expiresAt(token({ exp: '1700000000' }))).toBeUndefined()
    })

    it('handles a payload needing base64url decoding', () => {
      // '?' and '~' push the encoding into the - / _ alphabet.
      const claims = { sub: 'a?b~c/d+e', exp: 1_700_000_000 }
      expect(expiresAt(token(claims))).toBe('2023-11-14T22:13:20.000Z')
    })

    it('returns undefined rather than throwing on anything malformed', () => {
      expect(expiresAt('')).toBeUndefined()
      expect(expiresAt('not-a-token')).toBeUndefined()
      expect(expiresAt(token({ exp: 1 }, 2))).toBeUndefined() // only 2 segments
      expect(expiresAt('a.!!!notbase64!!!.c')).toBeUndefined()
      expect(expiresAt('a..c')).toBeUndefined()
    })
  })
}
