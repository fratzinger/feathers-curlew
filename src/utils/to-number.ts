import { CurlewError } from '../errors'

/** Coerce a flag value to a finite number, or fail with `E_INVALID_NUMBER`. */
export function toNumber(value: unknown, flag: string): number {
  const n = Number(value)
  if (!Number.isFinite(n))
    throw new CurlewError(
      `${flag} must be a number, got "${String(value)}".`,
      'E_INVALID_NUMBER',
    )
  return n
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  describe('toNumber', () => {
    it('parses numeric strings', () => {
      expect(toNumber('42', '--limit')).toBe(42)
      expect(toNumber('-5', '--skip')).toBe(-5)
      expect(toNumber('1.5', '--limit')).toBe(1.5)
    })

    it('passes numbers through', () => {
      expect(toNumber(0, '--skip')).toBe(0)
    })

    it('treats an empty string as 0, the way Number() does', () => {
      // Documenting the edge, not endorsing it: `--limit ""` means no limit change.
      expect(toNumber('', '--limit')).toBe(0)
    })

    it('rejects non-numeric input, naming the flag', () => {
      expect(() => toNumber('abc', '--limit')).toThrow(
        /--limit must be a number/,
      )
      expect(() => toNumber('abc', '--limit')).toThrow(/got "abc"/)
    })

    it('rejects undefined and Infinity with E_INVALID_NUMBER', () => {
      expect(() => toNumber(undefined, '--skip')).toThrow(
        expect.objectContaining({ code: 'E_INVALID_NUMBER' }),
      )
      expect(() => toNumber(Number.POSITIVE_INFINITY, '--skip')).toThrow()
    })
  })
}
