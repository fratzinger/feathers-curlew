import type { AuthenticatePayload, CurlewClient } from '../types'
import { defineCommand } from 'citty'
import { writeResult } from '../output'
import { commonArgs, parseJson } from './shared'

export function makeAuthenticateCommand(client: CurlewClient) {
  return defineCommand({
    meta: {
      name: 'authenticate',
      description: 'Authenticate and print the accessToken and user',
    },
    args: {
      strategy: {
        type: 'string',
        description: 'Authentication strategy',
        default: 'local',
      },
      email: { type: 'string', description: 'Email (local strategy)' },
      password: { type: 'string', description: 'Password (local strategy)' },
      data: {
        type: 'string',
        description: 'Full auth payload as JSON (merged over the flags)',
        alias: 'd',
      },
      pretty: commonArgs.pretty,
    },
    async run({ args }) {
      const payload: AuthenticatePayload = { strategy: args.strategy }
      if (args.email !== undefined) payload.email = args.email
      if (args.password !== undefined) payload.password = args.password
      const extra = parseJson(args.data, '--data')
      if (extra) Object.assign(payload, extra)
      const result = await client.authenticate(payload)
      writeResult(result, { pretty: args.pretty })
    },
  })
}
