import type { CurlewClient } from '../types'
import { defineCommand } from 'citty'
import { writeResult } from '../output'
import { commonArgs } from './shared'

export function makeServicesCommand(client: CurlewClient) {
  return defineCommand({
    meta: {
      name: 'services',
      description: 'List the service paths available to curlew',
    },
    args: { pretty: commonArgs.pretty },
    run({ args }) {
      writeResult(client.listServices() ?? [], { pretty: args.pretty })
    },
  })
}
