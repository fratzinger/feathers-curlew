import type { SubCommandsDef } from 'citty'
import type { CurlewClient, ResolvedOptions } from '../types'
import { defineCommand } from 'citty'
import { makeAuthenticateCommand } from '../commands/authenticate'
import { makeCallCommand } from '../commands/call'
import { makeCustomCommand } from '../commands/custom'
import { makeDescribeCommand } from '../commands/describe'
import { makeInstructionsCommand } from '../commands/instructions'
import { makeLogoutCommand } from '../commands/logout'
import { makeMethodCommands } from '../commands/method'
import { makeServicesCommand } from '../commands/services'
import { makeWaitUntilCommand } from '../commands/wait-until'
import { makeWatchCommand } from '../commands/watch'
import { makeWhoamiCommand } from '../commands/whoami'

export interface BuildCliContext {
  client: CurlewClient
  options: ResolvedOptions
  version?: string
}

/**
 * Assemble the citty command tree, closing over the curlew context.
 *
 * The tree is **static**: the service is an argument to a verb
 * (`curlew find users`), not a command of its own, so nothing has to be
 * introspected to build it. That also means any service path works — nested
 * (`api/v1/users`) and names that would otherwise collide with a curlew
 * command (a service called `services`).
 */
export function buildCli(ctx: BuildCliContext) {
  const { client, options, version } = ctx

  const subCommands: SubCommandsDef = {
    ...makeMethodCommands(client, options),
    authenticate: makeAuthenticateCommand(client, options),
    call: makeCallCommand(client, options),
    describe: makeDescribeCommand(client),
    instructions: makeInstructionsCommand(client, options),
    logout: makeLogoutCommand(client),
    services: makeServicesCommand(client),
    waitUntil: makeWaitUntilCommand(client, options),
    watch: makeWatchCommand(client, options),
    whoami: makeWhoamiCommand(client),
  }

  // Custom commands last: a user-defined command deliberately overrides a
  // built-in of the same name.
  for (const command of options.commands) {
    const cmd = makeCustomCommand(client, options, command)
    subCommands[command.name] = cmd
    for (const alias of command.aliases ?? []) {
      if (!subCommands[alias]) subCommands[alias] = cmd
    }
  }

  // No `run` on the root: citty invokes a parent's `run` even after a
  // sub-command handled the call. The runner shows usage for bare parents.
  return defineCommand({
    meta: {
      name: 'curlew',
      description: 'Drive your FeathersJS server from the command line.',
      version: version ?? '0.0.0',
    },
    subCommands,
  })
}
