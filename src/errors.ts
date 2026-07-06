/** Error type for curlew-level failures (bad input, missing peers, etc.). */
export class CurlewError extends Error {
  code: string

  constructor(message: string, code = 'E_CURLEW') {
    super(message)
    this.name = 'CurlewError'
    this.code = code
  }
}

export interface FormattedError {
  error: {
    name: string
    message: string
    code?: string | number
    className?: string
    data?: unknown
    errors?: unknown
  }
}

/**
 * Normalize any thrown value into a stable, JSON-serializable shape.
 * Feathers errors expose `code`/`className`/`data`/`errors`, which we surface
 * so an AI agent can react to them.
 */
export function formatError(error: unknown): FormattedError {
  if (error instanceof Error) {
    const e = error as Error & {
      code?: string | number
      className?: string
      data?: unknown
      errors?: unknown
    }
    return {
      error: {
        name: e.name,
        message: e.message,
        ...(e.code !== undefined ? { code: e.code } : {}),
        ...(e.className !== undefined ? { className: e.className } : {}),
        ...(e.data !== undefined ? { data: e.data } : {}),
        ...(e.errors !== undefined ? { errors: e.errors } : {}),
      },
    }
  }
  return { error: { name: 'Error', message: String(error) } }
}
