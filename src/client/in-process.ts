import type { Application } from '@feathersjs/feathers'
import type {
  AuthenticatePayload,
  AuthenticateResult,
  CurlewClient,
  ResolvedOptions,
} from '../types'
import { CurlewError } from '../errors'
import { buildParams } from '../params'
import { coerceId } from '../utils/coerce-id'

/**
 * In-process client: wraps a Feathers app and calls its services directly.
 * Permission handling lives in `buildParams`. App setup/teardown is owned by
 * the runner (per config), so `teardown` here is a no-op.
 */
export function createInProcessClient(
  app: Application,
  options: ResolvedOptions,
): CurlewClient {
  const service = (path: string): any => app.service(path)

  /**
   * A bound service method, or a clear error if the service doesn't have it.
   * The command tree is static (any verb accepts any service path), so this is
   * where "this service has no `find`" has to be caught.
   */
  const method = (path: string, name: string): ((...args: any[]) => any) => {
    const svc = service(path)
    if (typeof svc?.[name] !== 'function')
      throw new CurlewError(
        `Service "${path}" has no method "${name}".`,
        'E_UNKNOWN_METHOD',
      )
    return (...args: any[]) => svc[name](...args)
  }

  return {
    mode: 'in-process',
    app,
    listServices: () => Object.keys(app.services),
    async serviceMethods(path) {
      const svc = service(path)
      try {
        // `getServiceOptions` is a runtime value; import it lazily (and handle
        // the CJS/ESM interop of @feathersjs/feathers) so it stays optional.
        const mod = (await import('@feathersjs/feathers')) as any
        const getServiceOptions =
          mod.getServiceOptions ?? mod.default?.getServiceOptions
        return getServiceOptions ? getServiceOptions(svc)?.methods : undefined
      } catch {
        return undefined
      }
    },
    async find(path, ctx) {
      return method(path, 'find')(await buildParams(app, ctx, options))
    },
    async get(path, id, ctx) {
      return method(path, 'get')(
        coerceId(id),
        await buildParams(app, ctx, options),
      )
    },
    async create(path, data, ctx) {
      return method(path, 'create')(data, await buildParams(app, ctx, options))
    },
    async update(path, id, data, ctx) {
      return method(path, 'update')(
        coerceId(id),
        data,
        await buildParams(app, ctx, options),
      )
    },
    async patch(path, id, data, ctx) {
      return method(path, 'patch')(
        coerceId(id),
        data,
        await buildParams(app, ctx, options),
      )
    },
    async remove(path, id, ctx) {
      return method(path, 'remove')(
        coerceId(id),
        await buildParams(app, ctx, options),
      )
    },
    async custom(path, name, data, ctx) {
      return method(path, name)(data, await buildParams(app, ctx, options))
    },
    async authenticate(
      payload: AuthenticatePayload,
    ): Promise<AuthenticateResult> {
      const strategy = payload.strategy ?? 'local'
      return (await service(options.authService).create({
        ...payload,
        strategy,
      })) as AuthenticateResult
    },
    async whoami(ctx) {
      // buildParams resolves the user from --as/--token; internal calls have none.
      const params = (await buildParams(app, ctx, options)) as {
        user?: unknown
      }
      return params.user ?? null
    },
    async logout() {
      // No persisted session in-process.
    },
    async teardown() {
      // App lifecycle is owned by the runner; nothing transport-level to close.
    },
  }
}
