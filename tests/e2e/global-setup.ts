import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))

// Bundle the in-browser fake bridge (authored in TS) into a single IIFE that
// page.addInitScript can inject. Runs once before the suite.
export default async function globalSetup() {
  await build({
    entryPoints: [path.join(dir, 'bridge', 'fakeBridge.ts')],
    outfile: path.join(dir, '.generated', 'fakeBridge.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    logLevel: 'warning',
  })
}
