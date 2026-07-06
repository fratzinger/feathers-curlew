import type { CurlewPlugin, CurlewPluginContext } from './types'

/** Identity helper for defining a curlew plugin with types. */
export function defineCurlewPlugin(plugin: CurlewPlugin): CurlewPlugin {
  return plugin
}

/**
 * Run each plugin's `env` hook in order and apply the returned variables to
 * `process.env`. Call this BEFORE creating the app, so app modules read the
 * right values — which requires `createApp` to import the app lazily. A value
 * of `undefined` unsets the variable.
 */
export async function applyPluginEnv(
  plugins: CurlewPlugin[],
  context: CurlewPluginContext,
): Promise<void> {
  for (const plugin of plugins) {
    if (!plugin.env) continue
    const vars = await plugin.env(context)
    if (!vars) continue
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}
