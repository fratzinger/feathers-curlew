import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication'
import {
  hooks as localAuthHooks,
  LocalStrategy,
} from '@feathersjs/authentication-local'
import { feathers } from '@feathersjs/feathers'
import { bodyParser, errorHandler, koa, rest } from '@feathersjs/koa'
import { MemoryService } from '@feathersjs/memory'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRemoteClient } from '../src/client/remote'
import { resolvedOptions } from './helpers'

const { hashPassword, protect } = localAuthHooks

// Keep persisted JWTs out of the real user config dir.
process.env.XDG_CONFIG_HOME = join(tmpdir(), `curlew-test-${Date.now()}`)

let app: any
let server: any
let baseUrl: string

beforeAll(async () => {
  app = koa(feathers())
  app.use(errorHandler())
  app.use(bodyParser())
  app.configure(rest())

  app.set('authentication', {
    secret: 'test-secret',
    entity: 'user',
    service: 'users',
    authStrategies: ['jwt', 'local'],
    local: { usernameField: 'email', passwordField: 'password' },
  })

  app.use('messages', new MemoryService({ multi: true, paginate: false }))
  app.use('users', new MemoryService({ multi: true, paginate: false }))

  const authentication = new AuthenticationService(app)
  authentication.register('jwt', new JWTStrategy())
  authentication.register('local', new LocalStrategy())
  app.use('authentication', authentication)

  app.service('users').hooks({
    before: { create: [hashPassword('password')] },
    after: { all: [protect('password')] },
  })

  server = await app.listen(0)
  baseUrl = `http://localhost:${server.address().port}`
})

afterAll(async () => {
  await app.teardown?.()
  server?.close?.()
})

describe('remote client (rest)', () => {
  it('finds records on a public service', async () => {
    await app.service('messages').create({ text: 'hello remote' })
    const client = await createRemoteClient(
      { url: baseUrl, transport: 'rest', services: ['messages'] },
      resolvedOptions(),
    )
    try {
      const result = (await client.find('messages', {})) as any[]
      expect(Array.isArray(result)).toBe(true)
      expect(result.at(-1)?.text).toBe('hello remote')
      expect(client.listServices()).toContain('messages')
    } finally {
      await client.teardown()
    }
  })

  it('authenticates over the wire and returns a token', async () => {
    await app.service('users').create({ email: 'remote@b.c', password: 'pw' })
    const client = await createRemoteClient(
      { url: baseUrl, transport: 'rest', strategy: 'local' },
      resolvedOptions(),
    )
    try {
      const result = await client.authenticate({
        email: 'remote@b.c',
        password: 'pw',
      })
      expect(result.accessToken).toBeTruthy()
    } finally {
      await client.teardown()
    }
  })
})
