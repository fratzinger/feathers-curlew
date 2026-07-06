import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  dts: true,
  clean: true,
  sourcemap: true,
  // No `exports: true`: package.json bin/exports are hand-managed.
  // tsdown still detects the shebang in src/cli.ts, keeps it, and chmod 0o755's the output.
})
