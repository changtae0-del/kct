import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    // openai.ts가 import 시점에 클라이언트를 만듦 — 실제 호출은 모킹함
    env: {
      OPENAI_API_KEY: 'vitest-dummy-openai-key',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
