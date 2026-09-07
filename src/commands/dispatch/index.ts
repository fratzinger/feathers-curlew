import type { CallContext, CurlewClient } from '../../types'
import { CurlewError } from '../../errors'
import { firstOf } from '../../utils/first-of'
import { countMatching } from './count-matching'
import { isNotFound } from '../../utils/is-not-found'
import { parseJson } from '../../utils/parse-json'

/**
 * Route a `(service, method, id?, data?)` tuple to the right client call.
 *
 * Handles the standard CRUD methods, the `count` / `findAll` shorthands, and
 * falls back to a Feathers custom method `(data, params)` for anything else.
 */
export async function dispatch(
  client: CurlewClient,
  service: string,
  method: string,
  id: string | undefined,
  data: string | undefined,
  call: CallContext,
): Promise<unknown> {
  const requireId = (): string => {
    if (id === undefined)
      throw new CurlewError(
        `Method "${method}" requires an id argument.`,
        'E_ID_REQUIRED',
      )
    return id
  }
  const requireData = (): Record<string, unknown> => {
    const parsed = parseJson(data, '--data')
    if (parsed === undefined)
      throw new CurlewError(
        `Method "${method}" requires --data '<json>'.`,
        'E_DATA_REQUIRED',
      )
    return parsed
  }

  switch (method) {
    case 'find':
      return client.find(service, call)
    case 'findAll':
      return client.find(service, { ...call, paginate: false })
    case 'findOne': {
      const result = await client.find(service, {
        ...call,
        query: { ...(call.query ?? {}), $limit: 1 },
      })
      return firstOf(result)
    }
    case 'count':
      return (await countMatching(client, service, call)).total ?? 0
    case 'exists': {
      if (id !== undefined) {
        try {
          await client.get(service, id, call)
          return { exists: true }
        } catch (error) {
          if (isNotFound(error)) return { exists: false }
          throw error
        }
      }
      return {
        exists: ((await countMatching(client, service, call)).total ?? 0) > 0,
      }
    }
    case 'get':
      return client.get(service, requireId(), call)
    case 'create':
      return client.create(service, requireData(), call)
    case 'update':
      return client.update(service, requireId(), requireData(), call)
    case 'patch':
      return client.patch(service, requireId(), requireData(), call)
    case 'remove':
      return client.remove(service, requireId(), call)
    default:
      // Any other method is treated as a Feathers custom method `(data, params)`.
      return client.custom(
        service,
        method,
        parseJson(data, '--data') ?? {},
        call,
      )
  }
}
