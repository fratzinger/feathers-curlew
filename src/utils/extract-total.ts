/** Total from a paginated result (`{ total }`) or an array (`.length`). */
export function extractTotal(result: unknown): number | undefined {
  if (Array.isArray(result)) return result.length
  if (result && typeof result === 'object' && 'total' in result) {
    const total = (result as { total?: unknown }).total
    return typeof total === 'number' ? total : undefined
  }
  return undefined
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  describe('extractTotal', () => {
    it('counts an unpaginated array', () => {
      expect(extractTotal([1, 2, 3])).toBe(3)
      expect(extractTotal([])).toBe(0)
    })

    it('reads `total` from a paginated result', () => {
      expect(extractTotal({ total: 17, data: [] })).toBe(17)
      expect(extractTotal({ total: 0, data: [] })).toBe(0)
    })

    it('gives up on a non-numeric total', () => {
      expect(extractTotal({ total: '17' })).toBeUndefined()
    })

    it('gives up on anything else', () => {
      expect(extractTotal(undefined)).toBeUndefined()
      expect(extractTotal(null)).toBeUndefined()
      expect(extractTotal({ data: [] })).toBeUndefined()
      expect(extractTotal('nope')).toBeUndefined()
    })
  })
}
