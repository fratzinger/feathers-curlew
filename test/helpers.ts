import type { CurlewClient, ResolvedOptions } from '../src/types'
import { vi } from 'vitest'
import { DEFAULT_OPTIONS } from '../src/options'

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
  // Spread the real defaults so a new option can't silently drift out of sync.
  return { ...DEFAULT_OPTIONS, ...partial }
}

/** A stub `CurlewClient`; methods a test doesn't stub throw instead of silently passing. */
export function fakeClient(partial: Partial<CurlewClient> = {}): CurlewClient {
  const missing = (name: string) => (): never => {
    throw new Error(`fakeClient: ${name}() was not stubbed`)
  }
  return {
    mode: 'in-process',
    listServices: () => [],
    serviceMethods: missing('serviceMethods'),
    find: missing('find'),
    get: missing('get'),
    create: missing('create'),
    update: missing('update'),
    patch: missing('patch'),
    remove: missing('remove'),
    custom: missing('custom'),
    authenticate: missing('authenticate'),
    whoami: missing('whoami'),
    logout: async () => {},
    teardown: async () => {},
    ...partial,
  }
}
