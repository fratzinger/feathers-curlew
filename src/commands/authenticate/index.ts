import type {
  AuthenticatePayload,
  AuthenticateResult,
  CurlewClient,
  ResolvedOptions,
} from '../../types'
import { defineCommand } from 'citty'
import { CurlewError } from '../../errors'
import { mintAccessToken } from '../../impersonate'
import { writeRaw, writeResult } from '../../output'
import { parseJson } from '../../utils/parse-json'
import { commonArgs } from '../common-args'

export function makeAuthenticateCommand(
  client: CurlewClient,
  options: ResolvedOptions,
) {
  return defineCommand({
    meta: {
      name: 'authenticate',
      description: 'Authenticate and print the accessToken and user',
    },
    args: {
      strategy: {
        type: 'string',
        description: 'Authentication strategy',
        default: 'local',
      },
      email: { type: 'string', description: 'Email (local strategy)' },
      password: { type: 'string', description: 'Password (local strategy)' },
      data: {
        type: 'string',
        description: 'Full auth payload as JSON (merged over the flags)',
        alias: 'd',
      },
      // The same flag as everywhere else (same value, same `resolveUser`
      // lookup); only the effect differs, hence the own description.
      as: {
        ...commonArgs.as,
        description:
          'Mint a token for this user without credentials (needs `impersonate`, in-process only)',
      },
      'expires-in': {
        type: 'string',
        description:
          'Token lifetime for --as, e.g. "15m" (default: the app\'s)',
      },
      payload: {
        type: 'string',
        description: 'Extra JWT claims as JSON (--as only)',
      },
      raw: {
        type: 'boolean',
        description: 'Print only the accessToken, unquoted',
        default: false,
      },
      pretty: commonArgs.pretty,
    },
    async run({ args }) {
      const result =
        args.as !== undefined
          ? await impersonate(client, options, args)
          : await login(client, args)

      if (args.raw) writeRaw(result.accessToken)
      else writeResult(result, { pretty: args.pretty })
    },
  })
}

/** The regular path: hand credentials to a strategy and get a real token back. */
async function login(
  client: CurlewClient,
  args: { strategy: string; email?: string; password?: string; data?: string },
): Promise<AuthenticateResult> {
  const payload: AuthenticatePayload = { strategy: args.strategy }
  if (args.email !== undefined) payload.email = args.email
  if (args.password !== undefined) payload.password = args.password
  const extra = parseJson(args.data, '--data')
  if (extra) Object.assign(payload, extra)
  return client.authenticate(payload)
}

/**
 * The `--as` path: mint a token for a user without their credentials.
 *
 * Off unless `impersonate` is set — a minted JWT is a bearer credential that
 * outlives the process and travels (logs, chat, replay), which is a different
 * risk profile from curlew's ordinary internal calls.
 */
async function impersonate(
  client: CurlewClient,
  options: ResolvedOptions,
  args: { as?: string; 'expires-in'?: string; payload?: string },
): Promise<AuthenticateResult> {
  if (!client.app)
    throw new CurlewError(
      'authenticate --as is in-process only (it signs a token with the app\'s secret). Use "authenticate --strategy ..." against a remote server.',
      'E_REQUIRES_APP',
    )
  if (!options.impersonate)
    throw new CurlewError(
      'authenticate --as is disabled. Set `impersonate: true` in curlew.config.ts to allow minting tokens without credentials.',
      'E_IMPERSONATION_DISABLED',
    )
  return mintAccessToken(client.app, options, {
    as: args.as as string,
    expiresIn: args['expires-in'],
    payload: parseJson(args.payload, '--payload'),
  })
}
