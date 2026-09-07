import type { Application } from '@feathersjs/feathers'
import type { AuthenticateResult, ResolvedOptions } from '../types'
import { CurlewError } from '../errors'
import { resolveActingUser } from '../params'
import { expiresAt } from '../utils/jwt-expires-at'

/** The bits of `AuthenticationService` the mint needs, duck-typed. */
interface AuthServiceLike {
  configuration: {
    entity?: string | null
    entityId?: string
    service?: string
    [key: string]: unknown
  }
  getPayload: (
    authResult: Record<string, unknown>,
    params: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>
  getTokenOptions: (
    authResult: Record<string, unknown>,
    params: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>
  createAccessToken: (
    payload: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<string>
}

/** The auth service, or `undefined` if it isn't one (or isn't registered). */
function findAuthService(
  app: Application,
  options: ResolvedOptions,
): AuthServiceLike | undefined {
  let svc: AuthServiceLike | undefined
  try {
    svc = app.service(options.authService) as unknown as AuthServiceLike
  } catch {
    return undefined
  }
  const usable =
    svc &&
    typeof svc.createAccessToken === 'function' &&
    typeof svc.getPayload === 'function' &&
    typeof svc.getTokenOptions === 'function'
  return usable ? svc : undefined
}

export interface MintInput {
  /** The raw `--as` value. */
  as: string
  /** `--expires-in`, overriding the app's `jwtOptions.expiresIn`. */
  expiresIn?: string
  /** `--payload`, merged into the JWT claims. */
  payload?: Record<string, unknown>
}

/**
 * Mint an access token for a user without their credentials.
 *
 * Replays what `AuthenticationService.create` does after a strategy succeeds —
 * `getPayload` + `getTokenOptions` + `createAccessToken` — so the token carries
 * the app's own `secret`, `jwtOptions` and subject convention, and a custom
 * `getPayload` override still applies. Note that hooks on the authentication
 * service do NOT run: there is no strategy to authenticate.
 *
 * Gated by the `impersonate` option and in-process only; both are enforced by
 * the caller.
 */
export async function mintAccessToken(
  app: Application,
  options: ResolvedOptions,
  input: MintInput,
): Promise<AuthenticateResult> {
  // A custom `impersonate` function may not need an auth service at all, so
  // only the default mint insists on finding one.
  const auth = findAuthService(app, options)
  const entity = auth?.configuration.entity ?? 'user'
  const user = await resolveActingUser(app, input.as, options)

  let accessToken: string
  if (typeof options.impersonate === 'function') {
    accessToken = await options.impersonate({
      app,
      user,
      value: input.as,
      expiresIn: input.expiresIn,
      payload: input.payload,
      options,
    })
  } else {
    if (!auth)
      throw new CurlewError(
        `Service "${options.authService}" is not a Feathers AuthenticationService, so no token can be minted. Set "authService" in your curlew config, or pass your own \`impersonate\` function.`,
        'E_NOT_AUTH_SERVICE',
      )
    const authResult = { [entity]: user }
    const params = {
      payload: input.payload,
      jwtOptions: input.expiresIn ? { expiresIn: input.expiresIn } : {},
    }
    const [payload, jwtOptions] = await Promise.all([
      auth.getPayload(authResult, params),
      auth.getTokenOptions(authResult, params),
    ])
    // `getTokenOptions` only derives a subject when the auth service has an
    // `entity`; apps configured with `entity: null` would produce a token with
    // no `sub`, which the JWT strategy then rejects.
    if (jwtOptions.subject === undefined) {
      const idField =
        auth.configuration.entityId ??
        (auth.configuration.service
          ? (app.service(auth.configuration.service) as { id?: string }).id
          : undefined) ??
        (app.service(options.userService) as { id?: string }).id
      const subject = idField
        ? (user as Record<string, unknown>)?.[idField]
        : undefined
      if (subject === undefined)
        throw new CurlewError(
          `Could not determine the JWT subject for --as "${input.as}". Set "entityId" in your authentication config.`,
          'E_NO_SUBJECT',
        )
      jwtOptions.subject = String(subject)
    }
    accessToken = await auth.createAccessToken(payload, jwtOptions)
  }

  const exp = expiresAt(accessToken)
  return {
    accessToken,
    [entity]: user,
    ...(exp ? { expiresAt: exp } : {}),
  }
}
