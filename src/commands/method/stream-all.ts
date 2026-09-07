import type { CallContext, CurlewClient } from '../../types'

export const DEFAULT_PAGE_SIZE = 100

/**
 * Page through every matching record, handing each page to `write`.
 *
 * This is what makes `findAll --ndjson` streamable: instead of asking for the
 * whole result at once (`paginate: false`), it walks `$skip`/`$limit` so only
 * one page is ever in memory. Returns the number of records written.
 */
export async function streamAll(
  client: CurlewClient,
  service: string,
  call: CallContext,
  pageSize: number,
  write: (rows: readonly unknown[]) => void,
): Promise<number> {
  const query = { ...(call.query ?? {}) }
  let skip = Number(query.$skip ?? 0)
  let written = 0

  for (;;) {
    const page = await client.find(service, {
      ...call,
      query: { ...query, $limit: pageSize, $skip: skip },
    })
    const rows = Array.isArray(page)
      ? page
      : ((page as { data?: unknown[] })?.data ?? [])
    if (rows.length === 0) break

    write(rows)
    written += rows.length

    // A service that ignores $limit hands back everything on the first page;
    // paging further would loop forever, so stop once we have it all.
    if (rows.length >= pageSize) {
      if (rows.length > pageSize) break
      skip += pageSize
      continue
    }
    break
  }

  return written
}

if (import.meta.vitest) {
  const { describe, expect, it, vi } = import.meta.vitest

  const clientOver = (
    records: unknown[],
    opts: { honorLimit?: boolean } = {},
  ) => {
    const find = vi.fn(async (_service: string, ctx: CallContext) => {
      if (opts.honorLimit === false) return records
      const skip = Number(ctx.query?.$skip ?? 0)
      const limit = Number(ctx.query?.$limit ?? records.length)
      return records.slice(skip, skip + limit)
    })
    return { find } as unknown as CurlewClient & { find: typeof find }
  }

  const collect = () => {
    const seen: unknown[] = []
    return { seen, write: (rows: readonly unknown[]) => seen.push(...rows) }
  }

  describe('streamAll', () => {
    it('walks every page and writes each one', async () => {
      const records = Array.from({ length: 7 }, (_, i) => ({ i }))
      const client = clientOver(records)
      const { seen, write } = collect()
      const written = await streamAll(client, 'items', {}, 3, write)
      expect(written).toBe(7)
      expect(seen).toEqual(records)
      // 3 + 3 + 1 → the short page ends it, no extra empty request.
      expect(client.find).toHaveBeenCalledTimes(3)
    })

    it('stops on the first empty page', async () => {
      const client = clientOver([])
      const { seen, write } = collect()
      expect(await streamAll(client, 'items', {}, 3, write)).toBe(0)
      expect(seen).toEqual([])
      expect(client.find).toHaveBeenCalledTimes(1)
    })

    it('makes one extra request when the last page is exactly full', async () => {
      const client = clientOver([{ i: 0 }, { i: 1 }])
      const { write } = collect()
      expect(await streamAll(client, 'items', {}, 2, write)).toBe(2)
      expect(client.find).toHaveBeenCalledTimes(2)
    })

    it('does not loop forever when a service ignores $limit', async () => {
      const records = Array.from({ length: 10 }, (_, i) => ({ i }))
      const client = clientOver(records, { honorLimit: false })
      const { seen, write } = collect()
      expect(await streamAll(client, 'items', {}, 3, write)).toBe(10)
      expect(seen).toEqual(records)
      expect(client.find).toHaveBeenCalledTimes(1)
    })

    it('honors a $skip the caller already set', async () => {
      const records = Array.from({ length: 5 }, (_, i) => ({ i }))
      const client = clientOver(records)
      const { seen, write } = collect()
      await streamAll(client, 'items', { query: { $skip: 3 } }, 10, write)
      expect(seen).toEqual([{ i: 3 }, { i: 4 }])
    })

    it('reads a paginated { data } page as well as a bare array', async () => {
      const find = vi.fn(async () => ({ total: 2, data: [{ i: 0 }, { i: 1 }] }))
      const client = { find } as unknown as CurlewClient
      const { seen, write } = collect()
      expect(await streamAll(client, 'items', {}, 10, write)).toBe(2)
      expect(seen).toEqual([{ i: 0 }, { i: 1 }])
    })
  })
}
