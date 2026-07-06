import { formatError } from './errors'

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

/** Write a structured error as JSON to stderr. */
export function writeError(error: unknown, options: OutputOptions = {}): void {
  const payload = formatError(error)
  const json = options.pretty
    ? JSON.stringify(payload, null, 2)
    : JSON.stringify(payload)
  process.stderr.write(`${json}\n`)
}
