import type { CurlewClient } from '../types'
import { defineCommand } from 'citty'
import { writeResult } from '../output'
import { commonArgs } from './common-args'

/** `logout` — clear the stored remote session (no-op in-process). */
export function makeLogoutCommand(client: CurlewClient) {
  return defineCommand({
    meta: {
      name: 'logout',
      description: 'Clear the stored session (remote); a no-op in-process',
    },
    args: { pretty: commonArgs.pretty },
    async run({ args }) {
      await client.logout()
      writeResult(
        { loggedOut: true, mode: client.mode },
        { pretty: args.pretty },
      )
    },
  })
}
