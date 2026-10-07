// Writes package.json's version into src/index.ts's exported VERSION. The release workflow runs it
// right after `npm version`, so the release PR bumps both; test/version.test.ts fails if they ever
// disagree.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const indexPath = fileURLToPath(new URL('src/index.ts', root))

const source = readFileSync(indexPath, 'utf8')
const pattern = /^export const VERSION = '[^']*'$/m
if (!pattern.test(source)) {
  console.error(`sync-version: no "export const VERSION = '…'" line in src/index.ts`)
  process.exit(1)
}

writeFileSync(indexPath, source.replace(pattern, `export const VERSION = '${version}'`))
console.log(`sync-version: src/index.ts VERSION = ${version}`)
