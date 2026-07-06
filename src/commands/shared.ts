import type { ArgsDef } from 'citty'
import type { CallContext, CurlewClient } from '../types'
import { readFileSync } from 'node:fs'
import { CurlewError } from '../errors'
import { writeResult } from '../output'

/** Flags shared by every data-bearing command. */
export const commonArgs = {
  pretty: {
    type: 'boolean',
    description: 'Pretty-print the JSON output',
    default: false,
  },
  internal: {
    type: 'boolean',
    description: 'Force an internal, full-access call (bypasses auth)',
    default: false,
  },
  as: { type: 'string', description: 'Act as the user with this id' },
  token: { type: 'string', description: 'JWT used to authenticate this call' },
  query: {
    type: 'string',
    description: 'Feathers query as a JSON string',
    alias: 'q',
  },
  select: {
    type: 'string',
    description: 'Comma-separated fields to return ($select)',
  },
  sort: {
    type: 'string',
    description: 'Sort spec, e.g. "name:desc,age" or "-createdAt" ($sort)',
  },
  skip: { type: 'string', description: 'Number of records to skip ($skip)' },
  limit: { type: 'string', description: 'Maximum number of records ($limit)' },
  params: {
    type: 'string',
    description:
      'Extra Feathers params as JSON (in-process only; curlew flags win)',
  },
} satisfies ArgsDef

export type ServiceMethod =
  | 'find'
  | 'findAll'
  | 'findOne'
  | 'count'
  | 'exists'
  | 'get'
  | 'create'
  | 'update'
  | 'patch'
  | 'remove'

/** Resolve `@file` and `-` (stdin) inputs; a plain string is returned as-is. */
function resolveInput(value: string): string {
  if (value === '-') return readFileSync(0, 'utf8')
  if (value.startsWith('@')) return readFileSync(value.slice(1), 'utf8')
  return value
}

export function parseJson(
  value: string | undefined,
  flag: string,
): Record<string, unknown> | undefined {
  if (value === undefined) return undefined
  let text: string
  try {
    text = resolveInput(value)
  } catch (error) {
    throw new CurlewError(
      `Could not read ${flag} input: ${(error as Error).message}`,
      'E_INPUT_READ',
    )
  }
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch (error) {
    throw new CurlewError(
      `Invalid JSON for ${flag}: ${(error as Error).message}`,
      'E_INVALID_JSON',
    )
  }
}

function toNumber(value: unknown, flag: string): number {
  const n = Number(value)
  if (!Number.isFinite(n))
    throw new CurlewError(
      `${flag} must be a number, got "${String(value)}".`,
      'E_INVALID_NUMBER',
    )
  return n
}

/** Parse a sort spec: `"name:desc,-age,created"` → `{ name: -1, age: -1, created: 1 }`. */
function parseSort(spec: string): Record<string, number> {
  const sort: Record<string, number> = {}
  for (const raw of spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    let field = raw
    let dir = 1
    if (raw.includes(':')) {
      const [name, order] = raw.split(':')
      field = name ?? ''
      dir = /^(?:desc|-1)$/i.test(order ?? '') ? -1 : 1
    } else if (raw.startsWith('-')) {
      field = raw.slice(1)
      dir = -1
    } else if (raw.startsWith('+')) {
      field = raw.slice(1)
    }
    if (field) sort[field] = dir
  }
  return sort
}

/** Build the query from `--query` plus the `--select/--sort/--skip/--limit` conveniences (which win). */
function buildQuery(
  args: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const query: Record<string, unknown> = {
    ...(parseJson(args.query as string | undefined, '--query') ?? {}),
  }
  if (args.select !== undefined)
    query.$select = String(args.select)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  if (args.sort !== undefined) query.$sort = parseSort(String(args.sort))
  if (args.skip !== undefined) query.$skip = toNumber(args.skip, '--skip')
  if (args.limit !== undefined) query.$limit = toNumber(args.limit, '--limit')
  return Object.keys(query).length > 0 ? query : undefined
}

export function callFromArgs(args: Record<string, unknown>): CallContext {
  return {
    internal: args.internal === true ? true : undefined,
    as: (args.as as string | undefined) || undefined,
    token: (args.token as string | undefined) || undefined,
    query: buildQuery(args),
    params: parseJson(args.params as string | undefined, '--params'),
  }
}

export function makeOutput(
  args: Record<string, unknown>,
): (data: unknown) => void {
  return (data: unknown) => writeResult(data, { pretty: args.pretty === true })
}

/** Total from a paginated result (`{ total }`) or an array (`.length`). */
function extractTotal(result: unknown): number | undefined {
  if (Array.isArray(result)) return result.length
  if (result && typeof result === 'object' && 'total' in result) {
    const total = (result as { total?: unknown }).total
    return typeof total === 'number' ? total : undefined
  }
  return undefined
}

/** First record of an array or a paginated (`{ data }`) result, else `null`. */
function firstOf(result: unknown): unknown {
  if (Array.isArray(result)) return result[0] ?? null
  if (
    result &&
    typeof result === 'object' &&
    Array.isArray((result as { data?: unknown[] }).data)
  )
    return (result as { data: unknown[] }).data[0] ?? null
  return null
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; className?: unknown; name?: unknown }
  return e.code === 404 || e.className === 'not-found' || e.name === 'NotFound'
}

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
    case 'count': {
      const result = await client.find(service, {
        ...call,
        query: { ...(call.query ?? {}), $limit: 0 },
      })
      return extractTotal(result) ?? 0
    }
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
      const result = await client.find(service, {
        ...call,
        query: { ...(call.query ?? {}), $limit: 0 },
      })
      return { exists: (extractTotal(result) ?? 0) > 0 }
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
