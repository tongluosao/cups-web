import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve, dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(scriptDir, '../dist')
const cdnBase = (process.env.VITE_CDN_BASE_URL || '').trim()
const cdnOnly = process.env.CUPS_WEB_CDN_ONLY === 'true'

if (!cdnBase) {
  console.error('[cdn] VITE_CDN_BASE_URL is required for build:cdn')
  process.exit(1)
}

const normalizedBase = cdnBase.endsWith('/') ? cdnBase : `${cdnBase}/`

async function walk(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === '.vite') continue
    const rel = prefix ? posix.join(prefix, entry.name) : entry.name
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(abs, rel))
    } else {
      files.push(rel)
    }
  }
  return files
}

function uniq(values) {
  return Array.from(new Set(values))
}

function assetPath(file) {
  return file.startsWith('/') ? file.slice(1) : file
}

const manifestPath = resolve(distDir, '.vite/manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const entry = manifest['index.html']

if (!entry?.file) {
  console.error('[cdn] missing index.html entry in Vite manifest')
  process.exit(1)
}

const imports = (entry.imports || []).flatMap(name => {
  const chunk = manifest[name]
  return chunk?.file ? [assetPath(chunk.file)] : []
})

const dynamicImports = (entry.dynamicImports || []).flatMap(name => {
  const chunk = manifest[name]
  return chunk?.file ? [assetPath(chunk.file)] : []
})

const css = uniq((entry.css || []).map(assetPath))
const allFiles = await walk(distDir)
const cdnFiles = allFiles
  .filter(file =>
    file.startsWith('assets/') ||
    file.startsWith('pdfjs/') ||
    file === 'favicon.ico'
  )
  .sort()

const cdnManifest = {
  cdnBase: normalizedBase,
  cdnOnly,
  entry: assetPath(entry.file),
  imports: uniq(imports),
  dynamicImports: uniq(dynamicImports),
  css,
  files: cdnFiles
}

await writeFile(resolve(distDir, 'cdn-manifest.json'), JSON.stringify(cdnManifest, null, 2) + '\n')

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>CUPS Web</title>
  </head>
  <body>
    <div id="app" class="isolate"></div>
    <script>
      window.__CUPS_WEB_CDN_MANIFEST__ = ${JSON.stringify(cdnManifest)}
    </script>
    <script type="module">
      const manifest = window.__CUPS_WEB_CDN_MANIFEST__
      const cdnBase = manifest.cdnBase
      const localBase = '/'

      function loadStyle(base, href) {
        return new Promise((resolve, reject) => {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = base + href
          link.onload = resolve
          link.onerror = reject
          document.head.appendChild(link)
        })
      }

      async function loadApp(base) {
        window.__CUPS_WEB_ASSET_BASE__ = base
        await Promise.all(manifest.css.map(file => loadStyle(base, file)))
        await import(base + manifest.entry)
      }

      try {
        await loadApp(cdnBase)
      } catch (err) {
        if (manifest.cdnOnly) {
          console.error('[cups-web] CDN assets failed and no local fallback is bundled', err)
          document.getElementById('app').innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font:14px system-ui,sans-serif;color:#555;text-align:center;padding:24px">前端 CDN 资源加载失败，请检查网络或 CDN 发布路径。</div>'
          throw err
        }
        console.warn('[cups-web] CDN assets failed, falling back to local assets', err)
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => link.remove())
        await loadApp(localBase)
      }
    </script>
  </body>
</html>
`

await writeFile(resolve(distDir, 'index.html'), html)

if (cdnOnly) {
  await Promise.all([
    rm(resolve(distDir, 'assets'), { recursive: true, force: true }),
    rm(resolve(distDir, 'pdfjs'), { recursive: true, force: true }),
    rm(resolve(distDir, '.vite'), { recursive: true, force: true })
  ])
}

console.log(`[cdn] wrote cdn-manifest.json and CDN loader for ${normalizedBase}${cdnOnly ? ' (cdn-only)' : ''}`)
