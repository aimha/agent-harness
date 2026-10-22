// ============================================================
// ROLE: Checks that the published package contains every runtime file and nothing else
// DEPENDS ON: npm pack --dry-run, package.json files whitelist
// USED BY: npm test, CI of the package
// KEY DECISIONS: tests on the repo cannot see a file missing from the package, so this
//   compares the pack list with the files the CLI loads at runtime
// GOTCHAS: npm always adds package.json, README and LICENSE, whatever the whitelist says
// LAST UPDATED: 2026-10-22 - first version
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'child_process'
import { readdirSync } from 'fs'
import { join } from 'path'
import { PKG_ROOT } from '../lib/sync.js'

// Lists repo files under a folder as posix paths relative to the package root
function tree(dir) {
  return readdirSync(join(PKG_ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(PKG_ROOT.length + 1).replaceAll('\\', '/'))
}

test('npm pack ships bin, lib and assets in full, and no tests', () => {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const [{ files }] = JSON.parse(execFileSync(npm, ['pack', '--dry-run', '--json'], { cwd: PKG_ROOT, encoding: 'utf8' }))
  const packed = new Set(files.map((file) => file.path))
  for (const rel of [...tree('bin'), ...tree('lib'), ...tree('assets')]) assert.ok(packed.has(rel), `${rel} is missing from the package`)
  assert.equal([...packed].some((rel) => rel.startsWith('test/')), false)
})
