import type { Application } from '@feathersjs/feathers'
import type { CurlewOptions } from './types'
import { defu } from 'defu'

/** App setting key under which curlew stashes its options. */
export const CURLEW_KEY = 'curlew'

/**
 * Feathers plugin. Register with `app.configure(curlew(options))`. Options are
 * stashed on the app (`app.set('curlew', …)`); multiple calls accumulate.
 * This is the natural home for app-coupled custom commands (e.g. `sql`).
 */
export function curlew(
  options: CurlewOptions = {},
): (app: Application) => void {
  return (app: Application) => {
    const existing = (app.get(CURLEW_KEY) as CurlewOptions | undefined) ?? {}
    app.set(CURLEW_KEY, defu(options, existing))
  }
}
