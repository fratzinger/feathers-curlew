/** Whether an error is a Feathers `NotFound`, however it crossed the wire. */
export function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; className?: unknown; name?: unknown }
  return e.code === 404 || e.className === 'not-found' || e.name === 'NotFound'
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest
  // Imported inside the block: @feathersjs/errors is a devDependency and must
  // not become a runtime import of this module.
  const { NotFound } = await import('@feathersjs/errors')

  describe('isNotFound', () => {
    it('recognizes a real Feathers NotFound', () => {
      expect(isNotFound(new NotFound('nope'))).toBe(true)
    })

    it('recognizes each shape a NotFound can arrive in', () => {
      // Over the wire only some of these survive, hence all three checks.
      expect(isNotFound({ code: 404 })).toBe(true)
      expect(isNotFound({ className: 'not-found' })).toBe(true)
      expect(isNotFound({ name: 'NotFound' })).toBe(true)
    })

    it('rejects other errors', () => {
      expect(isNotFound({ code: 400 })).toBe(false)
      expect(isNotFound({ className: 'bad-request' })).toBe(false)
      expect(isNotFound(new Error('boom'))).toBe(false)
    })

    it('rejects non-objects', () => {
      expect(isNotFound(null)).toBe(false)
      expect(isNotFound(undefined)).toBe(false)
      expect(isNotFound('NotFound')).toBe(false)
    })
  })
}
