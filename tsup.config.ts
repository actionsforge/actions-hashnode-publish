// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  outDir: 'dist',
  target: 'node20',
  clean: true,
  dts: false,
  minify: false,
  sourcemap: false,
  noExternal: [
    '@actions/core',
    '@actions/github',
    '@actions/io',
    '@octokit/rest',
    'axios',
    'fs',
    'gray-matter',
    'js-yaml',
    'path'
  ],
  splitting: false
});
