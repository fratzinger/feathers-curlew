import { rowsOf, writeNdjson } from './ndjson'

import { formatError } from '../errors'

export interface OutputOptions {
  pretty?: boolean
}

/** Write a result as a single JSON line to stdout (indented with `--pretty`). */
export function writeResult(data: unknown, options: OutputOptions = {}): void {
  const json = options.pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data)
  process.stdout.write(`${json ?? 'null'}\n`)
}

/**
 * An `output(data)` closure honoring `--pretty` and `--ndjson`.
 *
 * `--ndjson` only applies to results that have rows; a single record or a bare
 * number is still written as one JSON line, so the flag is safe to pass
 * unconditionally.
 */
export function makeOutput(
  args: Record<string, unknown>,
): (data: unknown) => void {
  return (data: unknown) => {
    if (args.ndjson === true) {
      const rows = rowsOf(data)
      if (rows) return writeNdjson(rows)
    }
    writeResult(data, { pretty: args.pretty === true })
  }
}

/**
 * Write a bare string to stdout (no JSON quoting), for `--raw`. Keeps
 * `TOKEN=$(curlew authenticate --as 42 --raw)` usable from a shell.
 */
export function writeRaw(text: string): void {
  process.stdout.write(`${text}\n`)
}

/** Write a structured error as JSON to stderr. */
export function writeError(error: unknown, options: OutputOptions = {}): void {
  const payload = formatError(error)
  const json = options.pretty
    ? JSON.stringify(payload, null, 2)
    : JSON.stringify(payload)
  process.stderr.write(`${json}\n`)
}

export { rowsOf, writeNdjson } from './ndjson'
