import { readFileSync } from 'node:fs'
import { CurlewError } from '../errors'

/** Resolve `@file` and `-` (stdin) inputs; a plain string is returned as-is. */
function resolveInput(value: string): string {
  if (value === '-') return readFileSync(0, 'utf8')
  if (value.startsWith('@')) return readFileSync(value.slice(1), 'utf8')
  return value
}

/**
 * Parse a JSON flag value, accepting `@file.json` and `-` (stdin) as sources.
 * `flag` only names the flag in error messages.
 */
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

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest
  // Imported inside the block so the fixture helpers stay out of the module.
  const { mkdtempSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')

  const dir = mkdtempSync(join(tmpdir(), 'curlew-parse-json-'))
  const fixture = (name: string, content: string): string => {
    const file = join(dir, name)
    writeFileSync(file, content)
    return file
  }

  describe('parseJson', () => {
    it('parses an inline JSON string', () => {
      expect(parseJson('{"a":1}', '--data')).toEqual({ a: 1 })
    })

    it('passes undefined through, so an absent flag stays absent', () => {
      expect(parseJson(undefined, '--data')).toBeUndefined()
    })

    it('reads an @file source', () => {
      const file = fixture('ok.json', '{"from":"file"}')
      expect(parseJson(`@${file}`, '--data')).toEqual({ from: 'file' })
    })

    it('fails with E_INPUT_READ when the file is missing', () => {
      const missing = `@${join(dir, 'nope.json')}`
      expect(() => parseJson(missing, '--data')).toThrow(
        /Could not read --data input/,
      )
      expect(() => parseJson(missing, '--data')).toThrow(
        expect.objectContaining({ code: 'E_INPUT_READ' }),
      )
    })

    it('fails with E_INVALID_JSON on malformed JSON, naming the flag', () => {
      expect(() => parseJson('{nope}', '--query')).toThrow(
        expect.objectContaining({ code: 'E_INVALID_JSON' }),
      )
      expect(() => parseJson('{nope}', '--query')).toThrow(
        /Invalid JSON for --query/,
      )
    })

    it('reports a malformed @file against the flag, not the path', () => {
      const file = fixture('bad.json', '{nope}')
      expect(() => parseJson(`@${file}`, '--params')).toThrow(
        /Invalid JSON for --params/,
      )
    })
  })
}
