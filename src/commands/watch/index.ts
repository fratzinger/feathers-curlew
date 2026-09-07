import type { CurlewClient, ResolvedOptions } from '../../types'
import { defineCommand } from 'citty'
import { CurlewError } from '../../errors'
import { writeNdjson } from '../../output'
import { parseJson } from '../../utils/parse-json'
import { toNumber } from '../../utils/to-number'
import { watchEvents } from '../../wait'
import { commonArgs } from '../common-args'

/**
 * `watch <service> [event]` — stream matching events as NDJSON until
 * interrupted (in-process only).
 *
 * Where `waitUntil` blocks for one event and exits, this keeps printing, one
 * JSON line per event, so it can be piped or tailed.
 */
export function makeWatchCommand(
  client: CurlewClient,
  options: ResolvedOptions,
) {
  return defineCommand({
    meta: {
      name: 'watch',
      description:
        'Stream matching service events as NDJSON until interrupted (in-process only)',
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
      limit: {
        type: 'string',
        description: 'Stop after this many events (default: unlimited)',
      },
      timeout: {
        type: 'string',
        description: 'Stop after this many ms (default: run until interrupted)',
      },
    },
    async run({ args }) {
      if (!client.app) {
        throw new CurlewError(
          'watch is in-process only (it listens on app.service(...).on) and is unavailable in remote mode.',
          'E_REQUIRES_APP',
        )
      }
      await watchEvents(
        client.app,
        args.service,
        {
          events: args.event ? [args.event] : undefined,
          query: parseJson(args.query, '--query'),
          matcher: options.matcher,
          limit:
            args.limit === undefined
              ? undefined
              : toNumber(args.limit, '--limit'),
          timeout:
            args.timeout === undefined
              ? undefined
              : toNumber(args.timeout, '--timeout'),
        },
        (event) => writeNdjson([event]),
      )
    },
  })
}
