import type { CallContext, CurlewClient } from '../../types'
import { extractTotal } from '../../utils/extract-total'

/**
 * How many records match, and a few of them.
 *
 * A paginated service answers both from one `$limit: n` page (`total` + `data`).
 * A service with `paginate: false` returns a bare array and no total, so
 * `$limit: 0` would look like "nothing matches" — hence the second, unpaginated
 * request to count the set exactly. Getting this wrong is how a dry run tells
 * you a bulk delete affects 0 records right before it wipes the table.
 */
export async function countMatching(
  client: CurlewClient,
  service: string,
  call: CallContext,
  sampleSize = 0,
): Promise<{ total: number | null; sample: unknown[] }> {
  const query = call.query ?? {}
  const page = await client.find(service, {
    ...call,
    query: { ...query, $limit: sampleSize },
  })

  if (!Array.isArray(page)) {
    const rows = (page as { data?: unknown[] })?.data ?? []
    return { total: extractTotal(page) ?? null, sample: rows }
  }

  const all = await client.find(service, { ...call, paginate: false })
  const rows = Array.isArray(all) ? all : []
  return { total: rows.length, sample: rows.slice(0, sampleSize) }
}
