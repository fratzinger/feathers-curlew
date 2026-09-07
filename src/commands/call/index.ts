import type { CurlewClient, ResolvedOptions } from '../../types'
import { defineCommand } from 'citty'
import { makeOutput } from '../../output'
import { callFromArgs } from '../call-from-args'
import { commonArgs } from '../common-args'
import { dispatch } from '../dispatch'
import {
  assertBulkConfirmed,
  isWriteMethod,
  previewWrite,
} from '../method/write-guard'

/**
 * `call <service> <method> [id]` — the escape hatch for anything the verb
 * commands don't cover, above all Feathers **custom methods**, which are
 * `(data, params)` calls named by the service itself.
 */
export function makeCallCommand(
  client: CurlewClient,
  options: ResolvedOptions,
) {
  return defineCommand({
    meta: {
      name: 'call',
      description:
        'Call any service method by name, including Feathers custom methods',
    },
    args: {
      service: {
        type: 'positional',
        required: true,
        description: 'Service path (e.g. users or api/v1/users)',
      },
      method: {
        type: 'positional',
        required: true,
        description: 'Method name (a custom method, or any of the verbs)',
      },
      id: {
        type: 'positional',
        required: false,
        description: 'Id for get/update/patch/remove',
      },
      data: {
        type: 'string',
        description: 'JSON body for create/update/patch/custom methods',
        alias: 'd',
      },
      ...commonArgs,
    },
    async run({ args }) {
      const record = args as Record<string, unknown>
      const call = callFromArgs(record)

      // `call` reaches the same write methods, so it needs the same guards.
      if (isWriteMethod(args.method)) {
        // Dry run first: it must not need --yes (see method/index.ts).
        if (record['dry-run'] === true) {
          const report = await previewWrite(
            client,
            args.service,
            args.method,
            args.id,
            args.data,
            call,
          )
          return makeOutput(record)(report)
        }
        assertBulkConfirmed(options, args.method, args.id, record.yes === true)
      }

      const result = await dispatch(
        client,
        args.service,
        args.method,
        args.id,
        args.data,
        call,
      )
      makeOutput(record)(result)
    },
  })
}
