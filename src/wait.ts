import type { Application } from '@feathersjs/feathers'
import sift from 'sift'
import { CurlewError } from './errors'

export interface WaitForEventOptions {
  /** Events to listen for. @default ['created','updated','patched','removed'] */
  events?: string[]
  /** Feathers/Mongo query the event data must match (via sift). */
  query?: Record<string, unknown>
  /** Timeout in milliseconds. @default 30000 */
  timeout?: number
}

export interface WaitForEventResult {
  event: string
  service: string
  data: unknown
}

const DEFAULT_EVENTS = ['created', 'updated', 'patched', 'removed']
/** Feathers query keys that are pagination/projection, not match filters. */
const NON_FILTER_KEYS = new Set(['$select', '$sort', '$limit', '$skip'])

function toMatcher(
  query: Record<string, unknown> | undefined,
): (data: unknown) => boolean {
  if (!query || Object.keys(query).length === 0) return () => true
  const filter: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(query)) {
    if (!NON_FILTER_KEYS.has(key)) filter[key] = value
  }
  const test = sift(filter as any)
  return (data: unknown) => {
    try {
      return Boolean(test(data as any))
    } catch {
      return false
    }
  }
}

interface EventEmitterLike {
  on: (event: string, handler: (data: unknown) => void) => void
  removeListener: (event: string, handler: (data: unknown) => void) => void
}

/**
 * Resolve with the first `service` event whose data matches `query`, or reject
 * with an `E_TIMEOUT` CurlewError after `timeout` ms.
 *
 * In-process only: it listens on the service's EventEmitter
 * (`app.service(path).on(...)`), so it sees events the booted app emits itself
 * (background/scheduler jobs, external sources like queues or webhooks) — not
 * actions from a separate curlew process. Listeners are always cleaned up.
 */
export function waitForEvent(
  app: Application,
  service: string,
  options: WaitForEventOptions = {},
): Promise<WaitForEventResult> {
  const events = options.events?.length ? options.events : DEFAULT_EVENTS
  const timeout = options.timeout ?? 30_000
  const matches = toMatcher(options.query)
  const svc = app.service(service) as unknown as EventEmitterLike

  return new Promise<WaitForEventResult>((resolve, reject) => {
    const handlers: Array<[string, (data: unknown) => void]> = []

    const removeListeners = (): void => {
      for (const [event, handler] of handlers)
        svc.removeListener(event, handler)
    }

    const timer = setTimeout(() => {
      removeListeners()
      reject(
        new CurlewError(
          `Timed out after ${timeout}ms waiting for "${service}" event(s): ${events.join(', ')}`,
          'E_TIMEOUT',
        ),
      )
    }, timeout)

    for (const event of events) {
      const handler = (data: unknown): void => {
        if (matches(data)) {
          clearTimeout(timer)
          removeListeners()
          resolve({ event, service, data })
        }
      }
      svc.on(event, handler)
      handlers.push([event, handler])
    }
  })
}
