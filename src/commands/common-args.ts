import type { ArgsDef } from 'citty'

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
  as: {
    type: 'string',
    description: 'Act as this user (id, or whatever `resolveUser` accepts)',
  },
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
  ndjson: {
    type: 'boolean',
    description:
      'Stream results as newline-delimited JSON, one record per line',
    default: false,
  },
  'dry-run': {
    type: 'boolean',
    description: 'Report what a write would affect, without doing it',
    default: false,
  },
  yes: {
    type: 'boolean',
    description: 'Confirm a bulk write when `confirmBulk` is on',
    default: false,
    alias: 'y',
  },
} satisfies ArgsDef

/** The verbs curlew exposes as commands: Feathers' methods plus its shorthands. */
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
