import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/cli.ts', 'src/plugin.ts'],
  format: ['esm'],
  dts: true,
  external: [/^@deepseek-ai\//],
})
