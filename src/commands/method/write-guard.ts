import type { CallContext, CurlewClient, ResolvedOptions } from '../../types'
import { CurlewError } from '../../errors'
import { coerceId } from '../../utils/coerce-id'
import { parseJson } from '../../utils/parse-json'
import { countMatching } from '../dispatch/count-matching'

/** Methods that change data; only these honor --dry-run and confirmBulk. */
const WRITE_METHODS = new Set(['create', 'update', 'patch', 'remove'])

/** How many matching records a dry run shows. */
const SAMPLE_SIZE = 3

export function isWriteMethod(method: string): boolean {
  return WRITE_METHODS.has(method)
}

/** A bulk write is `patch`/`remove` with the literal id `null`. */
export function isBulkWrite(method: string, id: string | undefined): boolean {
  return (method === 'patch' || method === 'remove') && id === 'null'
}

/**
 * Refuse an unconfirmed bulk write when `confirmBulk` is on.
 *
 * `patch null` / `remove null` hit every matching record at once, and curlew
 * calls are internal by default, so nothing else stands between a stray query
 * and a wiped table.
 */
export function assertBulkConfirmed(
  options: ResolvedOptions,
  method: string,
  id: string | undefined,
  confirmed: boolean,
): void {
  if (!options.confirmBulk || confirmed || !isBulkWrite(method, id)) return
  throw new CurlewError(
    `"${method} <service> null" affects every matching record. Re-run with --yes to confirm, or --dry-run to see what it would hit.`,
    'E_BULK_CONFIRM',
  )
}

export interface DryRunReport {
  dryRun: true
  method: string
  service: string
  /** Records the write would touch, or `null` if it can't be determined. */
  wouldAffect: number | null
  sample: unknown[]
}

/**
 * Report what a write *would* do, without doing it.
 *
 * `sample` is always filled in, so a `wouldAffect: 0` from a service that
 * doesn't report totals is visible rather than reassuring.
 */
export async function previewWrite(
  client: CurlewClient,
  service: string,
  method: string,
  id: string | undefined,
  data: string | undefined,
  call: CallContext,
): Promise<DryRunReport> {
  const report = (
    wouldAffect: number | null,
    sample: unknown[],
  ): DryRunReport => ({ dryRun: true, method, service, wouldAffect, sample })

  if (method === 'create') {
    const body = parseJson(data, '--data')
    const rows = Array.isArray(body) ? (body as unknown[]) : body ? [body] : []
    return report(rows.length, rows.slice(0, SAMPLE_SIZE))
  }

  if (isBulkWrite(method, id)) {
    const { total, sample } = await countMatching(
      client,
      service,
      call,
      SAMPLE_SIZE,
    )
    return report(total, sample)
  }

  // A single addressed record: it either exists or the write would 404.
  if (id === undefined)
    throw new CurlewError(
      `Method "${method}" requires an id argument.`,
      'E_ID_REQUIRED',
    )
  try {
    const record = await client.get(service, String(coerceId(id)), call)
    return report(1, [record])
  } catch {
    return report(0, [])
  }
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest
  const { DEFAULT_OPTIONS } = await import('../../options')

  const options = (confirmBulk: boolean) => ({
    ...DEFAULT_OPTIONS,
    confirmBulk,
  })

  describe('isBulkWrite', () => {
    it('is only true for patch/remove with the literal null id', () => {
      expect(isBulkWrite('patch', 'null')).toBe(true)
      expect(isBulkWrite('remove', 'null')).toBe(true)
      expect(isBulkWrite('patch', '42')).toBe(false)
      expect(isBulkWrite('remove', undefined)).toBe(false)
      // create/update never take the bulk id.
      expect(isBulkWrite('create', 'null')).toBe(false)
      expect(isBulkWrite('update', 'null')).toBe(false)
    })
  })

  describe('assertBulkConfirmed', () => {
    it('does nothing while confirmBulk is off', () => {
      expect(() =>
        assertBulkConfirmed(options(false), 'remove', 'null', false),
      ).not.toThrow()
    })

    it('blocks an unconfirmed bulk write when it is on', () => {
      expect(() =>
        assertBulkConfirmed(options(true), 'remove', 'null', false),
      ).toThrow(expect.objectContaining({ code: 'E_BULK_CONFIRM' }))
    })

    it('lets --yes through', () => {
      expect(() =>
        assertBulkConfirmed(options(true), 'remove', 'null', true),
      ).not.toThrow()
    })

    it('never blocks a single-record write', () => {
      expect(() =>
        assertBulkConfirmed(options(true), 'remove', '42', false),
      ).not.toThrow()
    })
  })

  describe('isWriteMethod', () => {
    it('covers exactly the data-changing methods', () => {
      for (const m of ['create', 'update', 'patch', 'remove'])
        expect(isWriteMethod(m)).toBe(true)
      for (const m of ['find', 'findOne', 'findAll', 'count', 'exists', 'get'])
        expect(isWriteMethod(m)).toBe(false)
    })
  })
}
