import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    // Default environment for lib/ unit tests (SQL, auth, events, etc.)
    // React/hook tests opt in to jsdom via the @vitest-environment jsdom pragma
    environment: 'node',
    isolate: true,
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'tests/e2e'],
    setupFiles: ['./tests/unit/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
