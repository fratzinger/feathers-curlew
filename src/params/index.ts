import type { Application, Params } from '@feathersjs/feathers'
import type { CallContext, ResolvedOptions } from '../types'
import { defu } from 'defu'
import { CurlewError } from '../errors'
import { resolveActingUser } from './resolve-acting-user'

export { resolveActingUser } from './resolve-acting-user'

/**
 * Turn a per-call context into Feathers `params` for an in-process call.
 *
 * - `--as <user>` → resolve the user, set `provider` + `user` (authorization runs)
 * - `--token`     → resolve the JWT to a user, same authenticated shape
 * - internal      → `{ query }` with no `provider` ⇒ auth/authorization bypassed
 * - authenticated default without credentials → clear error
 *
 * Arbitrary extra params from `--params` are merged in; curlew's own flags
 * (query, provider, user, paginate) take precedence on conflicting keys.
 */
export async function buildParams(
  app: Application,
  call: CallContext,
  options: ResolvedOptions,
): Promise<Params> {
  const query = call.query ?? {}
  const pagination =
    call.paginate === undefined ? {} : { paginate: call.paginate }
  const extra = call.params ?? {}

  // `authenticated`/`authentication` live on the authentication package's
  // Params augmentation, which we don't import at runtime — hence the casts.
  // defu gives the first argument priority, so curlew's flags win over --params.
  if (call.as !== undefined) {
    const user = await resolveActingUser(app, call.as, options)
    return defu(
      {
        provider: options.provider,
        authenticated: true,
        user,
        query,
        ...pagination,
      },
      extra,
    ) as unknown as Params
  }

  if (call.token !== undefined) {
    const result = (await app.service(options.authService).create({
      strategy: 'jwt',
      accessToken: call.token,
    })) as { user?: unknown }
    return defu(
      {
        provider: options.provider,
        authenticated: true,
        user: result.user,
        authentication: { strategy: 'jwt', accessToken: call.token },
        query,
        ...pagination,
      },
      extra,
    ) as unknown as Params
  }

  const internal = call.internal ?? options.permission === 'internal'
  if (internal)
    return defu({ query, ...pagination }, extra) as unknown as Params

  throw new CurlewError(
    'Authenticated mode requires --as <user> or --token <jwt> (or pass --internal for a full-access call).',
    'E_AUTH_REQUIRED',
  )
}
