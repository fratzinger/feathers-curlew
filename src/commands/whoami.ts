import type { CurlewClient } from '../types'
import { defineCommand } from 'citty'
import { writeResult } from '../output'
import { callFromArgs, commonArgs } from './shared'

/** `whoami` — resolve the acting user from --token/--as or the stored session. */
export function makeWhoamiCommand(client: CurlewClient) {
  return defineCommand({
    meta: {
      name: 'whoami',
      description:
        'Resolve and print the current user (--token/--as, or the stored session)',
    },
    args: {
      as: commonArgs.as,
      token: commonArgs.token,
      pretty: commonArgs.pretty,
    },
    async run({ args }) {
      const user = await client.whoami(
        callFromArgs(args as Record<string, unknown>),
      )
      writeResult(user ?? null, { pretty: args.pretty })
    },
  })
}
