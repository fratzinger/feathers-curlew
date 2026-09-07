import sift from 'sift'

/** Feathers query keys that are pagination/projection, not match filters. */
const NON_FILTER_KEYS = new Set(['$select', '$sort', '$limit', '$skip'])

/**
 * Builds a predicate from a query. Same shape as `@feathersjs/memory`'s
 * `matcher` option, so a custom sift instance — or something else entirely —
 * drops straight in.
 */
export type QueryMatcher = (query: any) => any

/**
 * Turn a Feathers query into a predicate over event data.
 *
 * Pagination/projection operators are dropped first — they say how to *fetch*,
 * not what to *match* — so this holds for any matcher. An empty query matches
 * everything, and a matcher that throws on a given payload counts as no match
 * rather than tearing down the watch.
 */
export function toMatcher(
  query: Record<string, unknown> | undefined,
  matcher: QueryMatcher = sift,
): (data: unknown) => boolean {
  if (!query || Object.keys(query).length === 0) return () => true
  const filter: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(query)) {
    if (!NON_FILTER_KEYS.has(key)) filter[key] = value
  }
  const test = matcher(filter) as (data: unknown) => unknown
  return (data: unknown) => {
    try {
      return Boolean(test(data))
    } catch {
      return false
    }
  }
}

if (import.meta.vitest) {
  const { describe, expect, it, vi } = import.meta.vitest

  describe('toMatcher', () => {
    it('matches everything without a query', () => {
      expect(toMatcher(undefined)({ any: 'thing' })).toBe(true)
      expect(toMatcher({})({ any: 'thing' })).toBe(true)
    })

    it('matches on equality', () => {
      const match = toMatcher({ status: 'done' })
      expect(match({ status: 'done' })).toBe(true)
      expect(match({ status: 'open' })).toBe(false)
    })

    it('supports mongo-style operators', () => {
      const match = toMatcher({ count: { $gt: 5 } })
      expect(match({ count: 6 })).toBe(true)
      expect(match({ count: 5 })).toBe(false)
    })

    it('requires every key to match', () => {
      const match = toMatcher({ status: 'done', kind: 'a' })
      expect(match({ status: 'done', kind: 'a' })).toBe(true)
      expect(match({ status: 'done', kind: 'b' })).toBe(false)
    })

    it('ignores pagination and projection operators', () => {
      // $limit/$sort/etc. describe how to fetch, not what to match — a query
      // made only of them must not narrow anything.
      const match = toMatcher({
        $limit: 1,
        $skip: 2,
        $sort: { id: 1 },
        $select: ['id'],
      })
      expect(match({ anything: true })).toBe(true)
    })

    it('still applies the real filters alongside them', () => {
      const match = toMatcher({ status: 'done', $limit: 1 })
      expect(match({ status: 'done' })).toBe(true)
      expect(match({ status: 'open' })).toBe(false)
    })

    it('returns false instead of throwing on data sift cannot evaluate', () => {
      const match = toMatcher({ status: 'done' })
      expect(match(null)).toBe(false)
      expect(match(undefined)).toBe(false)
    })
  })

  describe('toMatcher with a custom matcher', () => {
    it('uses it instead of sift', () => {
      // Deliberately inverted, so a passing test can only mean it was used.
      const inverted = vi.fn(
        (q: any) => (data: any) => data?.status !== q.status,
      )
      const match = toMatcher({ status: 'done' }, inverted)
      expect(match({ status: 'done' })).toBe(false)
      expect(match({ status: 'open' })).toBe(true)
    })

    it('hands it the query with pagination keys already stripped', () => {
      const matcher = vi.fn(() => () => true)
      toMatcher({ status: 'done', $limit: 10, $sort: { id: 1 } }, matcher)
      expect(matcher).toHaveBeenCalledWith({ status: 'done' })
    })

    it('is not called at all for an empty query', () => {
      const matcher = vi.fn(() => () => true)
      expect(toMatcher({}, matcher)({ a: 1 })).toBe(true)
      expect(matcher).not.toHaveBeenCalled()
    })

    it('coerces a truthy non-boolean verdict', () => {
      const match = toMatcher({ a: 1 }, () => (d: any) => d.a)
      expect(match({ a: 1 })).toBe(true)
      expect(match({ a: 0 })).toBe(false)
    })

    it('treats a throwing matcher as no match', () => {
      const match = toMatcher({ a: 1 }, () => () => {
        throw new Error('boom')
      })
      expect(match({ a: 1 })).toBe(false)
    })
  })
}
