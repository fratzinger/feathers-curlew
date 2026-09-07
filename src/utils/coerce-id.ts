/**
 * Coerce a CLI id token: the literal `null` becomes JS `null` (Feathers bulk
 * `patch`/`remove` on `multi` services), numeric-looking ids become numbers,
 * everything else passes through unchanged.
 */
export function coerceId(id: string): string | number | null {
  if (id === 'null') return null
  return /^\d+$/.test(id) ? Number(id) : id
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  describe('coerceId', () => {
    it('coerces integer-looking ids to numbers', () => {
      expect(coerceId('42')).toBe(42)
      expect(coerceId('0')).toBe(0)
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

    it('leaves anything that is not plain digits as a string', () => {
      // Only /^\d+$/ coerces, so a sign, a decimal point, an exponent or
      // whitespace all keep the id a string.
      expect(coerceId('-1')).toBe('-1')
      expect(coerceId('1.5')).toBe('1.5')
      expect(coerceId('1e3')).toBe('1e3')
      expect(coerceId(' 42')).toBe(' 42')
    })

    it('coerces a leading-zero id too, losing the zeros', () => {
      // Sharp edge: an app with the string id '007' must be addressed some other
      // way — `--as` sidesteps this via `resolveUser`, positional ids do not.
      expect(coerceId('007')).toBe(7)
    })

    it('leaves an empty string alone', () => {
      expect(coerceId('')).toBe('')
    })
  })
}
