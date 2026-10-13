import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/cli.ts', 'src/plugin.ts', 'src/core/index.ts'],
  format: ['esm'],
  dts: true,
  external: [/^@deepseek-ai\//],
})
