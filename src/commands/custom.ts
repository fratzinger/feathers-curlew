import type { AnyCurlewCommand, CurlewClient, ResolvedOptions } from '../types'
import { defineCommand } from 'citty'
import { CurlewError } from '../errors'
import { callFromArgs, commonArgs, makeOutput } from './shared'

/**
 * Wrap a user-defined command as a citty command, injecting the curlew context
 * (client/app/options/output) via closure. `requiresApp` commands error clearly
 * in remote mode. If the handler returns a value (and didn't call `output`), it
 * is printed as JSON.
 */
export function makeCustomCommand(
  client: CurlewClient,
  options: ResolvedOptions,
  command: AnyCurlewCommand,
) {
  return defineCommand({
    meta: { name: command.name, description: command.description },
    args: { ...(command.args ?? {}), ...commonArgs },
    async run({ args, rawArgs }) {
      if (command.requiresApp && !client.app) {
        throw new CurlewError(
          `Command "${command.name}" requires in-process mode (it needs direct app access) and is unavailable in remote mode.`,
          'E_REQUIRES_APP',
        )
      }
      const record = args as Record<string, unknown>
      const output = makeOutput(record)
      const result = await command.run({
        args,
        rawArgs,
        client,
        app: client.app,
        call: callFromArgs(record),
        options,
        output,
      })
      if (result !== undefined) output(result)
    },
  })
}
