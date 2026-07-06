import type { CurlewConfig } from './types'
import { loadConfig } from 'c12'

/** Identity helper providing types/autocomplete for `curlew.config.ts`. */
export function defineCurlewConfig(config: CurlewConfig): CurlewConfig {
  return config
}

/**
 * Load `curlew.config.{ts,js,mjs,…}` from `cwd` via c12 (jiti-powered, so TS
 * configs load directly). Returns an empty object when no config is found.
 */
export async function loadCurlewConfig(
  cwd: string = process.cwd(),
): Promise<CurlewConfig> {
  const { config } = await loadConfig<CurlewConfig>({
    name: 'curlew',
    cwd,
  })
  return config ?? {}
}
