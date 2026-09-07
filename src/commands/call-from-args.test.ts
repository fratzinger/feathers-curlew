import { describe, expect, it } from 'vitest'
import { callFromArgs } from './call-from-args'

describe('callFromArgs', () => {
  it('leaves everything undefined for a bare call', () => {
    expect(callFromArgs({})).toEqual({
      internal: undefined,
      as: undefined,
      token: undefined,
      query: undefined,
      params: undefined,
    })
  })

  it('only sets internal when the flag is literally true', () => {
    expect(callFromArgs({ internal: true }).internal).toBe(true)
    // citty defaults the boolean to false; that must not read as "--internal".
    expect(callFromArgs({ internal: false }).internal).toBeUndefined()
  })

  it('carries --as and --token through verbatim', () => {
    const call = callFromArgs({ as: 'thomas@mueller.de', token: 'jwt' })
    expect(call.as).toBe('thomas@mueller.de')
    expect(call.token).toBe('jwt')
  })

  it('normalizes empty strings to undefined', () => {
    // An unset citty string flag can arrive as '', which must not count as --as.
    expect(callFromArgs({ as: '', token: '' })).toMatchObject({
      as: undefined,
      token: undefined,
    })
  })

  it('builds the query from --query and the shortcuts', () => {
    expect(callFromArgs({ query: '{"a":1}', limit: '5' }).query).toEqual({
      a: 1,
      $limit: 5,
    })
  })

  it('parses --params separately from the query', () => {
    const call = callFromArgs({ params: '{"foo":"bar"}' })
    expect(call.params).toEqual({ foo: 'bar' })
    expect(call.query).toBeUndefined()
  })
})
