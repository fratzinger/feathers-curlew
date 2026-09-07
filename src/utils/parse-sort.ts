/** Parse a sort spec: `"name:desc,-age,created"` → `{ name: -1, age: -1, created: 1 }`. */
export function parseSort(spec: string): Record<string, number> {
  const sort: Record<string, number> = {}
  for (const raw of spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    let field = raw
    let dir = 1
    if (raw.includes(':')) {
      const [name, order] = raw.split(':')
      field = name ?? ''
      dir = /^(?:desc|-1)$/i.test(order ?? '') ? -1 : 1
    } else if (raw.startsWith('-')) {
      field = raw.slice(1)
      dir = -1
    } else if (raw.startsWith('+')) {
      field = raw.slice(1)
    }
    if (field) sort[field] = dir
  }
  return sort
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  describe('parseSort', () => {
    it('defaults to ascending for a bare field', () => {
      expect(parseSort('name')).toEqual({ name: 1 })
    })

    it('reads the "field:desc" form, case-insensitively', () => {
      expect(parseSort('name:desc')).toEqual({ name: -1 })
      expect(parseSort('name:DESC')).toEqual({ name: -1 })
      expect(parseSort('name:-1')).toEqual({ name: -1 })
    })

    it('treats any other ":" suffix as ascending', () => {
      expect(parseSort('name:asc')).toEqual({ name: 1 })
      expect(parseSort('name:whatever')).toEqual({ name: 1 })
    })

    it('reads the "-field" and "+field" prefixes', () => {
      expect(parseSort('-createdAt')).toEqual({ createdAt: -1 })
      expect(parseSort('+createdAt')).toEqual({ createdAt: 1 })
    })

    it('mixes forms and preserves order', () => {
      expect(parseSort('name:desc,-age,created')).toEqual({
        name: -1,
        age: -1,
        created: 1,
      })
    })

    it('trims whitespace and drops empty segments', () => {
      expect(parseSort(' name , , -age ,')).toEqual({ name: 1, age: -1 })
    })

    it('lets a later entry win over an earlier one for the same field', () => {
      expect(parseSort('name,name:desc')).toEqual({ name: -1 })
    })

    it('returns an empty spec for an empty string', () => {
      expect(parseSort('')).toEqual({})
      expect(parseSort('  ')).toEqual({})
    })

    it('ignores a lone prefix with no field name', () => {
      expect(parseSort('-')).toEqual({})
    })
  })
}
