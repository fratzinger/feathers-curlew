import type { SubCommandsDef } from 'citty'
import type { CurlewClient, ResolvedOptions } from '../types'
import { defineCommand } from 'citty'
import { makeAuthenticateCommand } from './authenticate'
import { makeCustomCommand } from './custom'
import { makeDescribeCommand } from './describe'
import { makeInstructionsCommand } from './instructions'
import { makeLogoutCommand } from './logout'
import { makeGenericServiceCommand, makePerServiceCommand } from './service'
import { makeServicesCommand } from './services'
import { makeWaitUntilCommand } from './wait-until'
import { makeWhoamiCommand } from './whoami'

/** Only single-token service paths get a named sub-command; the rest use `service`. */
const SAFE_SERVICE_NAME = /^[a-z0-9][\w-]*$/i
const RESERVED = new Set([
  'authenticate',
  'describe',
  'instructions',
  'logout',
  'service',
  'services',
  'waitUntil',
  'whoami',
])

export interface BuildCliContext {
  client: CurlewClient
  options: ResolvedOptions
  version?: string
}

/** Assemble the full citty command tree, closing over the curlew context. */
export async function buildCli(ctx: BuildCliContext) {
  const { client, options, version } = ctx

  const subCommands: SubCommandsDef = {
    authenticate: makeAuthenticateCommand(client),
    describe: makeDescribeCommand(client),
    instructions: makeInstructionsCommand(client, options),
    logout: makeLogoutCommand(client),
    service: makeGenericServiceCommand(client),
    services: makeServicesCommand(client),
    waitUntil: makeWaitUntilCommand(client),
    whoami: makeWhoamiCommand(client),
  }

  // Named per-service commands, tailored to each service's exposed methods
  // (in-process introspects; remote falls back to the standard CRUD set).
  const discovered = client.listServices() ?? options.services
  for (const name of discovered) {
    if (
      !SAFE_SERVICE_NAME.test(name) ||
      RESERVED.has(name) ||
      subCommands[name]
    )
      continue
    const methods = await client.serviceMethods(name)
    subCommands[name] = makePerServiceCommand(client, name, methods)
  }

  // Custom commands (union of the plugin and config surfaces).
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
