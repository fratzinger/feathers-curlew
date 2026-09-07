import type { CallContext } from '../types'
import { buildQuery } from '../utils/build-query'
import { parseJson } from '../utils/parse-json'

/** Turn the parsed `commonArgs` into the per-call context the clients consume. */
export function callFromArgs(args: Record<string, unknown>): CallContext {
  return {
    internal: args.internal === true ? true : undefined,
    as: (args.as as string | undefined) || undefined,
    token: (args.token as string | undefined) || undefined,
    query: buildQuery(args),
    params: parseJson(args.params as string | undefined, '--params'),
  }
}
