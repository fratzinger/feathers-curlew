import type { Application } from '@feathersjs/feathers'
import type { ResolvedOptions } from '../types'
import { CurlewError } from '../errors'
import { coerceId } from '../utils/coerce-id'

/**
 * Turn an `--as <value>` flag into the acting user.
 *
 * Without `resolveUser` this is the historical behavior: load the value as an
 * id from `userService`. With it, user land decides — returning a user object
 * uses it as-is, returning an id has curlew load it.
 */
export async function resolveActingUser(
  app: Application,
  value: string,
  options: ResolvedOptions,
): Promise<unknown> {
  // `--as` names an identity, `--token` carries a credential. Catch the mix-up
  // here, before `resolveUser`, so user land never has to handle JWTs. The test
  // is deliberately narrow (`eyJ` = base64url `{"`, plus three segments) so a
  // real username can't trip it.
  if (value.startsWith('eyJ') && value.split('.').length === 3)
    throw new CurlewError(
      '--as expects a user, not a JWT. Use --token instead.',
      'E_AS_LOOKS_LIKE_JWT',
    )

  if (!options.resolveUser)
    return app
      .service(options.userService)
      .get(coerceId(value) as string | number)

  const resolved = await options.resolveUser({ app, value, options })
  if (resolved === null || resolved === undefined)
    throw new CurlewError(
      `Could not resolve --as "${value}" to a user.`,
      'E_USER_NOT_FOUND',
    )
  // An id from user land is passed through UNCOERCED: the author knows their
  // own id type, only the raw CLI string needs `coerceId`.
  if (typeof resolved !== 'object')
    return app.service(options.userService).get(resolved as string | number)
  return resolved
}
