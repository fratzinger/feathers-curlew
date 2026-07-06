import { describe, expect, it, vi } from 'vitest'
import { CurlewError } from '../src/errors'
import { writeError, writeResult } from '../src/output'

function grab(fn: () => void): { out: string; err: string } {
  const out: string[] = []
  const err: string[] = []
  const so = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => {
    out.push(String(c))
    return true
  })
  const se = vi.spyOn(process.stderr, 'write').mockImplementation((c: any) => {
    err.push(String(c))
    return true
  })
  try {
    fn()
  } finally {
    so.mockRestore()
    se.mockRestore()
  }
  return { out: out.join(''), err: err.join('') }
}

describe('output', () => {
  it('writes compact JSON with a trailing newline', () => {
    expect(grab(() => writeResult({ a: 1 })).out).toBe('{"a":1}\n')
  })

  it('pretty-prints when asked', () => {
    expect(grab(() => writeResult({ a: 1 }, { pretty: true })).out).toBe(
      '{\n  "a": 1\n}\n',
    )
  })

  it('renders undefined as null', () => {
    expect(grab(() => writeResult(undefined)).out).toBe('null\n')
  })

  it('formats a CurlewError to stderr with its code', () => {
    const { err } = grab(() => writeError(new CurlewError('boom', 'E_X')))
    const parsed = JSON.parse(err.trim())
    expect(parsed.error.name).toBe('CurlewError')
    expect(parsed.error.message).toBe('boom')
    expect(parsed.error.code).toBe('E_X')
  })

  it('surfaces Feathers-style error fields', () => {
    const feathersLike = Object.assign(new Error('nope'), {
      name: 'NotFound',
      code: 404,
      className: 'not-found',
    })
    const { err } = grab(() => writeError(feathersLike))
    const parsed = JSON.parse(err.trim())
    expect(parsed.error.code).toBe(404)
    expect(parsed.error.className).toBe('not-found')
  })
})
