// ============================================================
// ROLE: Checks that the shipped OpenSpec commands and skills match the pinned CLI and profile
// DEPENDS ON: scripts/openspec-assets.js (--check), pinned @fission-ai/openspec
// USED BY: npm test, CI of the package
// KEY DECISIONS: an OpenSpec upgrade or a profile change without regenerating the
//   assets fails here, before a release can ship stale commands to projects
// GOTCHAS: regeneration runs the real CLI in a temp dir, so this test takes a few seconds
// LAST UPDATED: 2026-10-22 - first version
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'child_process'
import { join } from 'path'
import { PKG_ROOT } from '../lib/sync.js'

test('OpenSpec files in the assets match the pinned CLI and profile', () => {
  const result = spawnSync(process.execPath, [join(PKG_ROOT, 'scripts', 'openspec-assets.js'), '--check'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
})
