import type { Application } from '@feathersjs/feathers'
import type { QueryMatcher } from './matcher'
import { toMatcher } from './matcher'

export interface WatchEventsOptions {
  /** Events to listen for. @default ['created','updated','patched','removed'] */
  events?: string[]
  /** Feathers/Mongo query the event data must match. */
  query?: Record<string, unknown>
  /** Override how the query becomes a predicate. @default sift */
  matcher?: QueryMatcher
  /** Stop after this many matching events. Unlimited when omitted. */
  limit?: number
  /** Stop after this many ms. Runs until interrupted when omitted. */
  timeout?: number
}

export interface WatchedEvent {
  event: string
  service: string
  data: unknown
}

const DEFAULT_EVENTS = ['created', 'updated', 'patched', 'removed']

interface EventEmitterLike {
  on: (event: string, handler: (data: unknown) => void) => void
  removeListener: (event: string, handler: (data: unknown) => void) => void
}

/**
 * Stream every matching `service` event to `onEvent` until `limit`/`timeout`
 * are reached — or forever, until the process is interrupted.
 *
 * The streaming counterpart to `waitForEvent`, and in-process only for the same
 * reason: it listens on the service's own EventEmitter, so it sees what the
 * booted app emits, not what another curlew process does. Listeners are always
 * cleaned up.
 */
export function watchEvents(
  app: Application,
  service: string,
  options: WatchEventsOptions,
  onEvent: (event: WatchedEvent) => void,
): Promise<number> {
  const events = options.events?.length ? options.events : DEFAULT_EVENTS
  const matches = toMatcher(options.query, options.matcher)
  const svc = app.service(service) as unknown as EventEmitterLike

  return new Promise<number>((resolve) => {
    const handlers: Array<[string, (data: unknown) => void]> = []
    let seen = 0
    let done = false

    const stop = (): void => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      for (const [event, handler] of handlers)
        svc.removeListener(event, handler)
      resolve(seen)
    }

    const timer = options.timeout
      ? (setTimeout(stop, options.timeout).unref?.() ??
        setTimeout(stop, options.timeout))
      : undefined

    for (const event of events) {
      const handler = (data: unknown): void => {
        if (done || !matches(data)) return
        seen += 1
        onEvent({ event, service, data })
        if (options.limit !== undefined && seen >= options.limit) stop()
      }
      svc.on(event, handler)
      handlers.push([event, handler])
    }
  })
}
