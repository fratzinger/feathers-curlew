import type { CurlewClient } from '../types'
import { defineCommand } from 'citty'
import { writeResult } from '../output'
import { commonArgs } from './shared'

const STANDARD_METHODS = ['find', 'get', 'create', 'update', 'patch', 'remove']

/** `describe <service>` — which methods (incl. custom) does a service support? */
export function makeDescribeCommand(client: CurlewClient) {
  return defineCommand({
    meta: {
      name: 'describe',
      description:
        'Show the methods a service supports (including custom methods)',
    },
    args: {
      path: { type: 'positional', required: true, description: 'Service path' },
      pretty: commonArgs.pretty,
    },
    async run({ args }) {
      const methods = await client.serviceMethods(args.path)
      writeResult(
        methods
          ? { service: args.path, methods }
          : {
              service: args.path,
              methods: STANDARD_METHODS,
              note: 'methods could not be introspected (remote or unsupported); standard methods assumed',
            },
        { pretty: args.pretty },
      )
    },
  })
}
