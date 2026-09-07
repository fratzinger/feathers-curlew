import type { ArgsDef } from 'citty'
import type { ServiceMethod } from '../common-args'
import { commonArgs } from '../common-args'
import { DEFAULT_PAGE_SIZE } from './stream-all'

const NEEDS_ID = new Set<ServiceMethod>(['get', 'update', 'patch', 'remove'])
const NEEDS_DATA = new Set<ServiceMethod>(['create', 'update', 'patch'])

const SERVICE_ARG = {
  type: 'positional',
  required: true,
  description: 'Service path (e.g. users or api/v1/users)',
} as const

/**
 * The citty args for one verb: the service positional first, then its
 * id/data, then the common flags. Positional order is key order, so the
 * service must be declared before the id.
 */
export function methodArgs(method: ServiceMethod): ArgsDef {
  const args: ArgsDef = { service: { ...SERVICE_ARG } }
  if (NEEDS_ID.has(method))
    args.id = {
      type: 'positional',
      required: true,
      description: 'Record id (or null for a bulk patch/remove)',
    }
  // `exists` takes an optional id: without one it checks by --query instead.
  if (method === 'exists')
    args.id = {
      type: 'positional',
      required: false,
      description: 'Record id (omit to check by --query)',
    }
  if (NEEDS_DATA.has(method))
    args.data = {
      type: 'string',
      description: 'JSON body for the record',
      alias: 'd',
    }
  // Only findAll pages through the whole result, so only it needs a page size.
  if (method === 'findAll')
    args['page-size'] = {
      type: 'string',
      description: `Records per request when streaming with --ndjson (default ${DEFAULT_PAGE_SIZE})`,
    }
  return { ...args, ...commonArgs }
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  const positionals = (args: ArgsDef) =>
    Object.entries(args)
      .filter(([, def]) => (def as { type?: string }).type === 'positional')
      .map(([name]) => name)

  describe('methodArgs', () => {
    it('always takes the service as its first positional', () => {
      for (const method of ['find', 'get', 'create', 'remove'] as const)
        expect(positionals(methodArgs(method))[0]).toBe('service')
    })

    it('always includes the common flags', () => {
      expect(methodArgs('find')).toMatchObject({ pretty: commonArgs.pretty })
    })

    it('puts the id after the service for the methods that address one record', () => {
      for (const method of ['get', 'update', 'patch', 'remove'] as const) {
        expect(positionals(methodArgs(method))).toEqual(['service', 'id'])
        expect(methodArgs(method).id).toMatchObject({ required: true })
      }
    })

    it('makes the id optional for exists', () => {
      expect(positionals(methodArgs('exists'))).toEqual(['service', 'id'])
      expect(methodArgs('exists').id).toMatchObject({ required: false })
    })

    it('takes no id for the read methods', () => {
      for (const method of ['find', 'findOne', 'findAll', 'count'] as const)
        expect(positionals(methodArgs(method))).toEqual(['service'])
    })

    it('adds --data only where a body is sent', () => {
      for (const method of ['create', 'update', 'patch'] as const)
        expect(methodArgs(method).data).toMatchObject({ alias: 'd' })
      for (const method of ['find', 'get', 'remove'] as const)
        expect(methodArgs(method).data).toBeUndefined()
    })
  })
}
