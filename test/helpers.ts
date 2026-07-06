import type { ResolvedOptions } from '../src/types'
import { vi } from 'vitest'

/** Capture writes to stdout/stderr while a curlew command runs. */
export function capture() {
  const chunks: string[] = []
  const errChunks: string[] = []
  const out = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => {
    chunks.push(String(c))
    return true
  })
  const err = vi.spyOn(process.stderr, 'write').mockImplementation((c: any) => {
    errChunks.push(String(c))
    return true
  })
  return {
    stdout: () => chunks.join(''),
    stderr: () => errChunks.join(''),
    json: () => JSON.parse(chunks.join('').trim()),
    errorJson: () => JSON.parse(errChunks.join('').trim()),
    restore: () => {
      out.mockRestore()
      err.mockRestore()
    },
  }
}

export function resolvedOptions(
  partial: Partial<ResolvedOptions> = {},
): ResolvedOptions {
  return {
    permission: 'internal',
    userService: 'users',
    authService: 'authentication',
    provider: 'curlew',
    services: [],
    commands: [],
    plugins: [],
    ...partial,
  }
}
