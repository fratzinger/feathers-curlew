import type { CurlewClient } from '../types'
import { defineCommand } from 'citty'
import { CurlewError } from '../errors'
import { writeResult } from '../output'
import { waitForEvent } from '../wait'
import { commonArgs, parseJson } from './shared'

/** `waitUntil <service> [event]` — block until a matching event fires (in-process only). */
export function makeWaitUntilCommand(client: CurlewClient) {
  return defineCommand({
    meta: {
      name: 'waitUntil',
      description:
        'Wait until a service emits a matching event, then print it (in-process only)',
    },
    args: {
      service: {
        type: 'positional',
        required: true,
        description: 'Service path',
      },
      event: {
        type: 'positional',
        required: false,
        description: 'Event name (default: created/updated/patched/removed)',
      },
      query: commonArgs.query,
      timeout: {
        type: 'string',
        description: 'Timeout in milliseconds',
        default: '30000',
      },
      pretty: commonArgs.pretty,
    },
    async run({ args }) {
      if (!client.app) {
        throw new CurlewError(
          'waitUntil is in-process only (it listens on app.service(...).on) and is unavailable in remote mode.',
          'E_REQUIRES_APP',
        )
      }
      const timeout = Number(args.timeout)
      if (!Number.isFinite(timeout))
        throw new CurlewError(
          `--timeout must be a number, got "${args.timeout}".`,
          'E_INVALID_NUMBER',
        )

      const result = await waitForEvent(client.app, args.service, {
        events: args.event ? [args.event] : undefined,
        query: parseJson(args.query, '--query'),
        timeout,
      })
      writeResult(result, { pretty: args.pretty })
    },
  })
}
