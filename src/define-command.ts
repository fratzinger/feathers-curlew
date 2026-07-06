import type { ArgsDef } from 'citty'
import type { CurlewCommand } from './types'

/**
 * Identity helper for defining a custom command with typed args. Named
 * `defineCurlewCommand` to avoid colliding with citty's `defineCommand`.
 */
export function defineCurlewCommand<T extends ArgsDef = ArgsDef>(
  command: CurlewCommand<T>,
): CurlewCommand<T> {
  return command
}
