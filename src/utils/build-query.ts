import { parseJson } from './parse-json'
import { parseSort } from './parse-sort'
import { toNumber } from './to-number'

/** Build the query from `--query` plus the `--select/--sort/--skip/--limit` conveniences (which win). */
export function buildQuery(
  args: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const query: Record<string, unknown> = {
    ...(parseJson(args.query as string | undefined, '--query') ?? {}),
  }
  if (args.select !== undefined)
    query.$select = String(args.select)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  if (args.sort !== undefined) query.$sort = parseSort(String(args.sort))
  if (args.skip !== undefined) query.$skip = toNumber(args.skip, '--skip')
  if (args.limit !== undefined) query.$limit = toNumber(args.limit, '--limit')
  return Object.keys(query).length > 0 ? query : undefined
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  describe('buildQuery', () => {
    it('returns undefined when nothing was passed', () => {
      expect(buildQuery({})).toBeUndefined()
    })

    it('returns undefined for an empty --query object', () => {
      expect(buildQuery({ query: '{}' })).toBeUndefined()
    })

    it('parses --query on its own', () => {
      expect(buildQuery({ query: '{"active":true}' })).toEqual({ active: true })
    })

    it('maps each shortcut to its Feathers operator', () => {
      expect(
        buildQuery({
          select: 'id,email',
          sort: '-createdAt',
          skip: '5',
          limit: '10',
        }),
      ).toEqual({
        $select: ['id', 'email'],
        $sort: { createdAt: -1 },
        $skip: 5,
        $limit: 10,
      })
    })

    it('trims and drops empty fields in --select', () => {
      expect(buildQuery({ select: ' id , , email ' })).toEqual({
        $select: ['id', 'email'],
      })
    })

    it('merges the shortcuts into --query, with the shortcuts winning', () => {
      expect(
        buildQuery({ query: '{"active":true,"$limit":1}', limit: '10' }),
      ).toEqual({ active: true, $limit: 10 })
    })

    it('keeps a --query operator the shortcuts do not touch', () => {
      expect(buildQuery({ query: '{"$limit":1}', skip: '2' })).toEqual({
        $limit: 1,
        $skip: 2,
      })
    })

    it('propagates a bad --limit as E_INVALID_NUMBER', () => {
      expect(() => buildQuery({ limit: 'abc' })).toThrow(
        expect.objectContaining({ code: 'E_INVALID_NUMBER' }),
      )
    })
  })
}
