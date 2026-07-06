#!/usr/bin/env node
import type { CurlewMode, RemoteConfig, RemoteTransport } from './types'
import { createRequire } from 'node:module'
import { createRemoteClient } from './client/remote'
import { loadCurlewConfig } from './config'
import { resolveOptions } from './options'
import { writeError } from './output'
import { applyPluginEnv } from './plugins'
import { runCurlew } from './runner'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

interface BinFlags {
  mode?: CurlewMode
  url?: string
  transport?: RemoteTransport
  cwd?: string
  rest: string[]
}

/** Peel off curlew's own (transport-selection) flags before the command tree. */
function peelBinFlags(argv: string[]): BinFlags {
  const rest: string[] = []
  const flags: BinFlags = { rest }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--remote':
        flags.mode = 'remote'
        break
      case '--in-process':
        flags.mode = 'in-process'
        break
      case '--url':
        flags.url = argv[++i]
        break
      case '--transport':
        flags.transport = argv[++i] as RemoteTransport
        break
      case '--mode':
        flags.mode = argv[++i] as CurlewMode
        break
      case '--cwd':
        flags.cwd = argv[++i]
        break
      default:
        rest.push(arg)
    }
  }
  return flags
}

const BARE_HELP = `curlew — drive your FeathersJS server from the CLI

No curlew.config.ts was found (or it has no createApp).

Usage:
  curlew <command> [options]               in-process (needs createApp() in curlew.config.ts)
  curlew --remote --url <url> <command>    against a running server

Built-in commands:
  authenticate --email <e> --password <p>
  services
  service <path> <method> [id] [--data <json>]
  <service> find|get|create|update|patch|remove

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
