import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(scriptDir, '..')
const distDir = resolve(frontendRoot, 'dist')
const outDir = resolve(frontendRoot, '..', 'cdn-dist-output')

const entries = [
  'assets',
  'pdfjs',
  'sponsor.png',
  'cdn-manifest.json'
]

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

for (const entry of entries) {
  await cp(resolve(distDir, entry), resolve(outDir, entry), { recursive: true, force: true })
}

await writeFile(resolve(outDir, 'README.md'), [
  '# cups-web CDN assets',
  '',
  'This branch contains built frontend assets for jsDelivr.',
  'It is generated from `frontend/dist` by `frontend/scripts/prepare-cdn-branch.js`.',
  ''
].join('\n'))

console.log(`[cdn] prepared ${outDir}`)
