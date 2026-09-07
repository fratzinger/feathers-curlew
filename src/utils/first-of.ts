/** First record of an array or a paginated (`{ data }`) result, else `null`. */
export function firstOf(result: unknown): unknown {
  if (Array.isArray(result)) return result[0] ?? null
  if (
    result &&
    typeof result === 'object' &&
    Array.isArray((result as { data?: unknown[] }).data)
  )
    return (result as { data: unknown[] }).data[0] ?? null
  return null
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  describe('firstOf', () => {
    it('takes the first item of an array', () => {
      expect(firstOf([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 })
    })

    it('takes the first item of a paginated result', () => {
      expect(firstOf({ total: 2, data: [{ id: 1 }, { id: 2 }] })).toEqual({
        id: 1,
      })
    })

    it('returns null rather than undefined when there is nothing', () => {
      expect(firstOf([])).toBeNull()
      expect(firstOf({ total: 0, data: [] })).toBeNull()
    })

    it('returns null for a shape it does not recognize', () => {
      expect(firstOf(null)).toBeNull()
      expect(firstOf({ id: 1 })).toBeNull()
      expect(firstOf('nope')).toBeNull()
    })
  })
}
