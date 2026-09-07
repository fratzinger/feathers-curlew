import type { CurlewOptions, ResolvedOptions } from './types'
import { defu } from 'defu'

export const DEFAULT_OPTIONS: ResolvedOptions = {
  permission: 'internal',
  userService: 'users',
  impersonate: false,
  confirmBulk: false,
  authService: 'authentication',
  provider: 'curlew',
  services: [],
  commands: [],
  plugins: [],
}

function pickOptions(source: CurlewOptions | undefined): CurlewOptions {
  if (!source) return {}
  const picked: CurlewOptions = {}
  if (source.permission !== undefined) picked.permission = source.permission
  if (source.userService !== undefined) picked.userService = source.userService
  if (source.resolveUser !== undefined) picked.resolveUser = source.resolveUser
  if (source.impersonate !== undefined) picked.impersonate = source.impersonate
  if (source.confirmBulk !== undefined) picked.confirmBulk = source.confirmBulk
  if (source.matcher !== undefined) picked.matcher = source.matcher
  if (source.authService !== undefined) picked.authService = source.authService
  if (source.provider !== undefined) picked.provider = source.provider
  if (source.services !== undefined) picked.services = source.services
  if (source.commands !== undefined) picked.commands = source.commands
  if (source.plugins !== undefined) picked.plugins = source.plugins
  return picked
}

function dedupeByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (seen.has(item.name)) continue
    seen.add(item.name)
    result.push(item)
  }
  return result
}

/**
 * Merge the two configuration surfaces.
 *
 * Precedence: config-file > plugin (`app.get('curlew')`) > defaults. `defu`
 * concatenates arrays, so `commands`/`plugins` from both surfaces are unioned;
 * plugin-contributed commands are folded in, then everything is deduped by name
 * (config-file wins).
 */
export function resolveOptions(
  appOptions: CurlewOptions | undefined,
  fileOptions: CurlewOptions | undefined,
): ResolvedOptions {
  const merged = defu(
    pickOptions(fileOptions),
    pickOptions(appOptions),
    DEFAULT_OPTIONS,
  ) as ResolvedOptions
  merged.plugins = dedupeByName(merged.plugins)
  const pluginCommands = merged.plugins.flatMap(
    (plugin) => plugin.commands ?? [],
  )
  merged.commands = dedupeByName([...merged.commands, ...pluginCommands])
  return merged
}
