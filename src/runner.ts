import type { Application } from '@feathersjs/feathers'
import type { CommandDef } from 'citty'
import type {
  CurlewClient,
  CurlewOptions,
  ResolvedOptions,
  RunCurlewOptions,
} from './types'
import { runCommand, showUsage } from 'citty'
import { createInProcessClient } from './client/in-process'
import { buildCli } from './commands'
import { resolveOptions } from './options'
import { writeError } from './output'

/** Marks an app we've already set up, so repeated runs don't re-run setup. */
const SETUP_FLAG = Symbol.for('feathers-curlew.setup')

function isClient(target: Application | CurlewClient): target is CurlewClient {
  return (
    typeof (target as CurlewClient).mode === 'string' &&
    typeof (target as CurlewClient).find === 'function'
  )
}

async function runSetup(
  app: Application,
  setup: RunCurlewOptions['setup'],
): Promise<void> {
  if (setup === false) return
  const record = app as unknown as Record<symbol, boolean>
  if (record[SETUP_FLAG]) return
  if (typeof setup === 'function') await setup(app)
  else await app.setup()
  record[SETUP_FLAG] = true
}

async function runTeardown(
  app: Application,
  teardown: RunCurlewOptions['teardown'],
): Promise<void> {
  if (teardown === false) return
  if (typeof teardown === 'function') await teardown(app)
  else await app.teardown()
}

/** Walk the leading positionals to the deepest matching command (stops at the first flag). */
function resolveTarget(root: CommandDef, argv: string[]): CommandDef {
  let cmd = root
  for (const token of argv) {
    if (token.startsWith('-')) break
    const subs = cmd.subCommands as Record<string, CommandDef> | undefined
    if (!subs) break
    const next = subs[token]
    if (!next || typeof next === 'function') break
    cmd = next
  }
  return cmd
}

function hasSubCommands(cmd: CommandDef): boolean {
  const subs = cmd.subCommands as Record<string, unknown> | undefined
  return !!subs && Object.keys(subs).length > 0
}

/**
 * Run curlew against a Feathers `Application` (in-process) or a pre-built
 * `CurlewClient` (e.g. remote). Owns app setup/teardown when handed an app.
 * Resolves to the process exit code; never calls `process.exit` itself.
 */
export async function runCurlew(
  target: Application | CurlewClient,
  opts: RunCurlewOptions = {},
): Promise<number> {
  const argv = opts.argv ?? process.argv.slice(2)
  const pretty = argv.includes('--pretty')

  const app: Application | undefined = isClient(target) ? target.app : target
  const ownsApp = !isClient(target)
  const options: ResolvedOptions = resolveOptions(
    app?.get('curlew') as CurlewOptions | undefined,
    opts,
  )
  const client: CurlewClient = isClient(target)
    ? target
    : createInProcessClient(target, options)

  let setupDone = false
  let exitCode = 0
  try {
    if (argv[0] === '--version' || argv[0] === '-v') {
      process.stdout.write(`${opts.version ?? '0.0.0'}\n`)
    } else {
      const root = await buildCli({ client, options, version: opts.version })
      const matched = resolveTarget(root, argv)
      if (
        argv.length === 0 ||
        argv.includes('--help') ||
        argv.includes('-h') ||
        hasSubCommands(matched)
      ) {
        // No command, an explicit --help, or a bare parent path — show usage.
        await showUsage(matched)
      } else {
        if (ownsApp && app) {
          await runSetup(app, opts.setup)
          setupDone = true
        }
        await runCommand(root, { rawArgs: argv })
      }
    }
  } catch (error) {
    writeError(error, { pretty })
    exitCode = 1
  } finally {
    try {
      await client.teardown()
    } catch {
      // ignore transport teardown errors
    }
    if (ownsApp && app && setupDone) {
      try {
        await runTeardown(app, opts.teardown)
      } catch (error) {
        writeError(error, { pretty })
      }
    }
  }
  return exitCode
}
