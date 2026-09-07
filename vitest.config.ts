import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Tests import the package by name. Without this they would resolve through
    // package.json to dist/, silently testing the last build instead of src.
    alias: {
      'feathers-curlew': fileURLToPath(
        new URL('./src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Pure helpers in src/utils keep their tests in-source (`import.meta.vitest`);
    // tsdown strips those blocks from the build via `define`.
    includeSource: ['src/**/*.ts'],
    environment: 'node',
    testTimeout: 20_000,
  },
})
