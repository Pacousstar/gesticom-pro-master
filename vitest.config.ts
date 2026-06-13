import { defineConfig } from 'vitest/config'
import path from 'path'

const shims = path.resolve(__dirname, 'test-shims')

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    include: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    exclude: ['e2e/**', '.next/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      'next/server': path.join(shims, 'server.js'),
      'next/cache': path.join(shims, 'cache.js'),
      'next/headers': path.join(shims, 'headers.js'),
    },
  },
})
