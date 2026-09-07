import type { SubCommandsDef } from 'citty'
import type { CurlewClient, ResolvedOptions } from '../../types'
import type { ServiceMethod } from '../common-args'
import { defineCommand } from 'citty'
import { makeOutput, writeNdjson } from '../../output'
import { toNumber } from '../../utils/to-number'
import { callFromArgs } from '../call-from-args'
import { dispatch } from '../dispatch'
import { methodArgs } from './method-args'
import { DEFAULT_PAGE_SIZE, streamAll } from './stream-all'
import { assertBulkConfirmed, isWriteMethod, previewWrite } from './write-guard'

/**
 * The verbs curlew exposes at the top level, in help order. The first six are
 * Feathers' own methods; the rest are curlew read shorthands built on `find`.
 */
const METHODS: Array<[ServiceMethod, string]> = [
  ['find', 'Find records in a service (paginated)'],
  ['findOne', 'Find the first matching record, or null'],
  ['findAll', 'Find every matching record (pagination off)'],
  ['count', 'Count matching records (a bare number)'],
  ['exists', 'Whether a record exists ({ exists }, never a 404)'],
  ['get', 'Get one record by id'],
  ['create', 'Create a record (an array creates many)'],
  ['update', 'Replace a record by id'],
  ['patch', 'Patch a record by id (null patches every match)'],
  ['remove', 'Remove a record by id (null removes every match)'],
]

function makeMethodCommand(
  client: CurlewClient,
  options: ResolvedOptions,
  method: ServiceMethod,
  description: string,
) {
  return defineCommand({
    meta: { name: method, description },
    args: methodArgs(method),
    async run({ args }) {
      const record = args as Record<string, unknown>
      const call = callFromArgs(record)
      const id = record.id as string | undefined
      const data = record.data as string | undefined

      if (isWriteMethod(method)) {
        // Dry run first: previewing a bulk write is exactly what confirmBulk
        // wants you to do, so it must not need --yes.
        if (record['dry-run'] === true) {
          const report = await previewWrite(
            client,
            args.service,
            method,
            id,
            data,
            call,
          )
          return makeOutput(record)(report)
        }
        assertBulkConfirmed(options, method, id, record.yes === true)
      }

      // `findAll --ndjson` streams page by page instead of materializing the
      // whole result, so a large service can't blow up memory or a context
      // window. Without --ndjson there is nothing to stream into.
      if (method === 'findAll' && record.ndjson === true) {
        const pageSize =
          record['page-size'] === undefined
            ? DEFAULT_PAGE_SIZE
            : toNumber(record['page-size'], '--page-size')
        await streamAll(client, args.service, call, pageSize, writeNdjson)
        return
      }

      const result = await dispatch(
        client,
        args.service,
        method,
        id,
        data,
        call,
      )
      makeOutput(record)(result)
    },
  })
}

/**
 * The verb commands: `curlew <method> <service> [id]`. The service is an
 * argument rather than a command, so any path works — including nested ones
 * (`api/v1/users`) and names that collide with curlew's own commands.
 */
export function makeMethodCommands(
  client: CurlewClient,
  options: ResolvedOptions,
): SubCommandsDef {
  const subCommands: SubCommandsDef = {}
  for (const [method, description] of METHODS)
    subCommands[method] = makeMethodCommand(
      client,
      options,
      method,
      description,
    )
  return subCommands
}

/** The verb names, for collision checks and help text. */
export const METHOD_NAMES = METHODS.map(([method]) => method)
