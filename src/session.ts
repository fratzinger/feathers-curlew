import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Minimal synchronous storage matching the feathers auth-client interface. */
export interface CurlewStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

function sessionFile(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(base, 'feathers-curlew', 'sessions.json')
}

function load(file: string): Record<string, string> {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

function save(file: string, data: Record<string, string>): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 })
}

/**
 * File-backed JWT storage for remote mode. Node has no `localStorage`, so the
 * feathers auth-client needs an explicit adapter. Tokens live in a
 * 0600 JSON file under the OS config dir, namespaced by remote URL.
 */
export function createFileStorage(namespace: string): CurlewStorage {
  const file = sessionFile()
  const scopedKey = (key: string): string => `${namespace}::${key}`
  return {
    getItem(key) {
      return load(file)[scopedKey(key)] ?? null
    },
    setItem(key, value) {
      const data = load(file)
      data[scopedKey(key)] = value
      save(file, data)
    },
    removeItem(key) {
      const data = load(file)
      delete data[scopedKey(key)]
      save(file, data)
    },
  }
}
