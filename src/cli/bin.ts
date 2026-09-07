#!/usr/bin/env node
import type { CurlewMode, RemoteConfig } from '../types'
import { createRequire } from 'node:module'
import { createRemoteClient } from '../client/remote'
import { loadCurlewConfig } from '../config'
import { resolveOptions } from '../options'
import { writeError } from '../output'
import { applyPluginEnv } from '../plugins'
import { runCurlew } from '../runner'
import { peelBinFlags } from './bin-flags'

const require = createRequire(import.meta.url)
// Relative to the BUNDLE (dist/cli.mjs), not to this source file — moving this
// file does not change the path, but changing the tsdown output name would.
const pkg = require('../package.json') as { version: string }

const BARE_HELP = `curlew — drive your FeathersJS server from the CLI

No curlew.config.ts was found (or it has no createApp).

Usage:
  curlew <command> [options]               in-process (needs createApp() in curlew.config.ts)
  curlew --remote --url <url> <command>    against a running server

Built-in commands:
  find|findOne|findAll|count|exists <service> [--query <json>]
  get|remove <service> <id>
  create|update|patch <service> [id] [--data <json>]
  call <service> <method> [id]       any method, incl. Feathers custom methods
  watch <service> [event]            stream events as NDJSON
  services                           list service paths
  describe <service>                 the methods a service supports
  authenticate --email <e> --password <p>

Safety: --dry-run previews a write, --ndjson streams large results.

Common flags: --pretty --internal --as <id> --token <jwt> --query <json>
`

async function main(): Promise<number> {
  const flags = peelBinFlags(process.argv.slice(2))

  // `--version` works without any app or config.
  if (flags.rest[0] === '--version' || flags.rest[0] === '-v') {
    process.stdout.write(`${pkg.version}\n`)
    return 0
  }

  const config = await loadCurlewConfig(flags.cwd)
  const mode: CurlewMode =
    flags.mode ?? (flags.url ? 'remote' : (config.defaultMode ?? 'in-process'))

  // Run plugin env hooks before the app boots — createApp should import lazily.
  await applyPluginEnv(config.plugins ?? [], {
    mode,
    cwd: flags.cwd ?? process.cwd(),
    argv: flags.rest,
  })

  if (mode === 'remote') {
    const remote: RemoteConfig = {
      url: flags.url ?? config.remote?.url ?? '',
      transport: flags.transport ?? config.remote?.transport ?? 'rest',
      services: config.remote?.services,
      strategy: config.remote?.strategy,
    }
    if (!remote.url) {
      throw new Error(
        'Remote mode requires a URL. Pass --url <url> or set remote.url in curlew.config.ts.',
      )
    }
    const client = await createRemoteClient(
      remote,
      resolveOptions(undefined, config),
    )
    return runCurlew(client, {
      ...config,
      argv: flags.rest,
      version: pkg.version,
    })
  }

  if (!config.createApp) {
    const wantsHelp =
      flags.rest.length === 0 ||
      flags.rest.includes('--help') ||
      flags.rest.includes('-h')
    if (wantsHelp) {
      process.stdout.write(BARE_HELP)
      return 0
    }
    throw new Error(
      'In-process mode requires createApp() in curlew.config.ts, or pass --remote --url <url>.',
    )
  }
  const app = await config.createApp()
  return runCurlew(app, { ...config, argv: flags.rest, version: pkg.version })
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    writeError(error)
    process.exit(1)
  })
