import type { ArgsDef, SubCommandsDef } from 'citty'
import type { CurlewClient } from '../types'
import type { ServiceMethod } from './shared'
import { defineCommand } from 'citty'
import { callFromArgs, commonArgs, dispatch, makeOutput } from './shared'

const STANDARD_METHODS = new Set([
  'find',
  'get',
  'create',
  'update',
  'patch',
  'remove',
])
/** Fallback when methods can't be introspected (remote mode). */
const DEFAULT_METHODS = ['find', 'get', 'create', 'update', 'patch', 'remove']

/** Generic passthrough that works for any (including nested) service path. */
export function makeGenericServiceCommand(client: CurlewClient) {
  return defineCommand({
    meta: {
      name: 'service',
      description:
        'Call any service method directly: service <path> <method> [id]',
    },
    args: {
      path: {
        type: 'positional',
        required: true,
        description: 'Service path (e.g. users or api/v1/users)',
      },
      method: {
        type: 'positional',
        required: true,
        description:
          'find|findAll|count|get|create|update|patch|remove, or a custom method',
      },
      id: {
        type: 'positional',
        required: false,
        description: 'Id for get/update/patch/remove',
      },
      data: {
        type: 'string',
        description: 'JSON body for create/update/patch/custom methods',
        alias: 'd',
      },
      ...commonArgs,
    },
    async run({ args }) {
      const call = callFromArgs(args as Record<string, unknown>)
      const result = await dispatch(
        client,
        args.path,
        args.method,
        args.id,
        args.data,
        call,
      )
      makeOutput(args as Record<string, unknown>)(result)
    },
  })
}

function methodArgs(method: ServiceMethod): ArgsDef {
  const needsId =
    method === 'get' ||
    method === 'update' ||
    method === 'patch' ||
    method === 'remove'
  const needsData =
    method === 'create' || method === 'update' || method === 'patch'
  const args: ArgsDef = { ...commonArgs }
  if (needsId)
    args.id = { type: 'positional', required: true, description: 'Record id' }
  if (method === 'exists')
    args.id = {
      type: 'positional',
      required: false,
      description: 'Record id (omit to check by --query)',
    }
  if (needsData)
    args.data = {
      type: 'string',
      description: 'JSON body for the record',
      alias: 'd',
    }
  return args
}

/**
 * Named per-service command. Sub-commands are tailored to the service's
 * **exposed** methods (`getServiceOptions().methods`): CRUD verbs only when the
 * service supports them, the read shorthands when `find` is exposed, and every
 * custom method as its own sub-command. `methods` is undefined in remote mode,
 * where we fall back to the standard CRUD set.
 */
export function makePerServiceCommand(
  client: CurlewClient,
  name: string,
  methods?: string[],
) {
  const leaf = (method: ServiceMethod) =>
    defineCommand({
      meta: { name: method, description: `${method} on the "${name}" service` },
      args: methodArgs(method),
      async run({ args }) {
        const record = args as Record<string, unknown>
        const result = await dispatch(
          client,
          name,
          method,
          record.id as string | undefined,
          record.data as string | undefined,
          callFromArgs(record),
        )
        makeOutput(record)(result)
      },
    })

  const customLeaf = (method: string) =>
    defineCommand({
      meta: {
        name: method,
        description: `Custom method "${method}" on the "${name}" service`,
      },
      args: {
        data: { type: 'string', description: 'JSON body (data)', alias: 'd' },
        ...commonArgs,
      },
      async run({ args }) {
        const record = args as Record<string, unknown>
        const result = await dispatch(
          client,
          name,
          method,
          undefined,
          record.data as string | undefined,
          callFromArgs(record),
        )
        makeOutput(record)(result)
      },
    })

  const exposed = methods ?? DEFAULT_METHODS
  const has = (method: string): boolean => exposed.includes(method)
  const subCommands: SubCommandsDef = {}

  if (has('find')) {
    subCommands.find = leaf('find')
    subCommands.findOne = leaf('findOne')
    subCommands.findAll = leaf('findAll')
    subCommands.count = leaf('count')
    subCommands.exists = leaf('exists')
  }
  if (has('get')) subCommands.get = leaf('get')
  if (has('create')) subCommands.create = leaf('create')
  if (has('update')) subCommands.update = leaf('update')
  if (has('patch')) subCommands.patch = leaf('patch')
  if (has('remove')) subCommands.remove = leaf('remove')

  // Every exposed method that isn't standard CRUD is a custom method.
  for (const method of exposed) {
    if (!STANDARD_METHODS.has(method) && !subCommands[method])
      subCommands[method] = customLeaf(method)
  }

  return defineCommand({
    meta: { name, description: `Commands for the "${name}" service` },
    subCommands,
  })
}
