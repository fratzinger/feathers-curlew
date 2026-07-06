import type {
  AuthenticatePayload,
  AuthenticateResult,
  CallContext,
  CurlewClient,
  RemoteConfig,
  ResolvedOptions,
} from '../types'
import { consola } from 'consola'
import { CurlewError } from '../errors'
import { coerceId } from '../params'
import { createFileStorage } from '../session'

interface FeathersLikeApp {
  configure: (fn: (app: any) => void) => unknown
  service: (path: string) => any
  authenticate: (payload: any) => Promise<any>
  reAuthenticate: () => Promise<any>
  logout: () => Promise<any>
}

async function importOptional<T = any>(name: string): Promise<T> {
  try {
    return (await import(name)) as T
  } catch {
    throw new CurlewError(
      `Remote mode needs the optional peer dependency "${name}". Install it, e.g. pnpm add ${name}`,
      'E_MISSING_PEER',
    )
  }
}

/**
 * Remote client: talks to a running server over REST (default) or Socket.IO.
 * The transport packages are optional peers, imported lazily so in-process
 * users never need them. `--internal`/`--as` are meaningless over the wire and
 * are warned-and-ignored.
 */
export async function createRemoteClient(
  remote: RemoteConfig,
  options: ResolvedOptions,
): Promise<CurlewClient> {
  const { feathers } = await importOptional('@feathersjs/feathers')
  const authentication = (
    await importOptional('@feathersjs/authentication-client')
  ).default
  const storage = createFileStorage(remote.url)

  const app = feathers() as unknown as FeathersLikeApp
  let disconnect: (() => void) | undefined

  if (remote.transport === 'socketio') {
    const io = (await importOptional('socket.io-client')).io
    const socketioClient = (await importOptional('@feathersjs/socketio-client'))
      .default
    const socket = io(remote.url)
    disconnect = () => socket.disconnect()
    app.configure(socketioClient(socket))
  } else {
    const rest = (await importOptional('@feathersjs/rest-client')).default
    app.configure(rest(remote.url).fetch(globalThis.fetch))
  }

  app.configure(
    authentication({ storage, storageKey: `${remote.url}::feathers-jwt` }),
  )

  // Restore a previously stored session if one is valid.
  let sessionUser: unknown = null
  try {
    const restored = (await app.reAuthenticate()) as { user?: unknown }
    sessionUser = restored?.user ?? null
  } catch {
    // not logged in yet — that's fine
  }

  const toParams = (ctx: CallContext): Record<string, unknown> => {
    if (ctx.internal)
      consola.warn(
        'curlew: --internal is ignored in remote mode (the server enforces auth over the wire).',
      )
    if (ctx.as)
      consola.warn(
        'curlew: --as is ignored in remote mode (the server enforces auth over the wire).',
      )
    if (ctx.params)
      consola.warn(
        'curlew: --params is ignored in remote mode (extra params are server-side only).',
      )
    const params: Record<string, unknown> = { query: ctx.query ?? {} }
    if (ctx.token) params.headers = { Authorization: `Bearer ${ctx.token}` }
    return params
  }

  return {
    mode: 'remote',
    app: undefined,
    listServices: () =>
      (options.services.length ? options.services : remote.services) ??
      undefined,
    async serviceMethods() {
      // A running server exposes no standard method-introspection endpoint.
      return undefined
    },
    async find(path, ctx) {
      return app.service(path).find(toParams(ctx))
    },
    async get(path, id, ctx) {
      return app.service(path).get(coerceId(id), toParams(ctx))
    },
    async create(path, data, ctx) {
      return app.service(path).create(data, toParams(ctx))
    },
    async update(path, id, data, ctx) {
      return app.service(path).update(coerceId(id), data, toParams(ctx))
    },
    async patch(path, id, data, ctx) {
      return app.service(path).patch(coerceId(id), data, toParams(ctx))
    },
    async remove(path, id, ctx) {
      return app.service(path).remove(coerceId(id), toParams(ctx))
    },
    async custom(path, method, data, ctx) {
      const svc = app.service(path)
      if (typeof svc[method] !== 'function') {
        throw new CurlewError(
          `Remote service "${path}" has no method "${method}" (custom methods must be registered on the client service).`,
          'E_UNKNOWN_METHOD',
        )
      }
      return svc[method](data, toParams(ctx))
    },
    async authenticate(
      payload: AuthenticatePayload,
    ): Promise<AuthenticateResult> {
      const strategy = payload.strategy ?? remote.strategy ?? 'local'
      const result = (await app.authenticate({
        ...payload,
        strategy,
      })) as AuthenticateResult
      sessionUser = result.user ?? sessionUser
      return result
    },
    async whoami() {
      // Remote can't verify an arbitrary --token locally; report the session user.
      return sessionUser
    },
    async logout() {
      await app.logout()
      sessionUser = null
    },
    async teardown() {
      disconnect?.()
    },
  }
}
