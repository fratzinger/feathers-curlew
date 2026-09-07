import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/bin.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  dts: true,
  // Drops the `if (import.meta.vitest)` in-source test blocks from the bundle.
  define: { 'import.meta.vitest': 'undefined' },
  clean: true,
  sourcemap: true,
  // No `exports: true`: package.json bin/exports are hand-managed.
  // tsdown still detects the shebang in src/cli.ts, keeps it, and chmod 0o755's the output.
})
