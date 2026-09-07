/**
 * The rows of a result, if it has any: a bare array, or the `data` of a
 * paginated page. A single record or a bare number has no rows.
 */
export function rowsOf(data: unknown): unknown[] | undefined {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const page = (data as { data?: unknown }).data
    if (Array.isArray(page)) return page
  }
  return undefined
}

/**
 * Write records as newline-delimited JSON — one compact line each, so a large
 * result stays streamable and `head`-able instead of one unbounded line.
 */
export function writeNdjson(rows: readonly unknown[]): void {
  let out = ''
  for (const row of rows) out += `${JSON.stringify(row) ?? 'null'}\n`
  if (out) process.stdout.write(out)
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  describe('rowsOf', () => {
    it('takes a bare array as its own rows', () => {
      expect(rowsOf([{ a: 1 }])).toEqual([{ a: 1 }])
      expect(rowsOf([])).toEqual([])
    })

    it('unwraps a paginated page', () => {
      expect(rowsOf({ total: 1, data: [{ a: 1 }] })).toEqual([{ a: 1 }])
    })

    it('has no rows for a single record or a scalar', () => {
      // These stay one JSON line, so --ndjson is safe to pass unconditionally.
      expect(rowsOf({ id: 1 })).toBeUndefined()
      expect(rowsOf(42)).toBeUndefined()
      expect(rowsOf(null)).toBeUndefined()
      expect(rowsOf('nope')).toBeUndefined()
    })

    it('ignores a non-array `data` property', () => {
      expect(rowsOf({ data: 'not-rows' })).toBeUndefined()
    })
  })
}
