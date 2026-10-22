// ============================================================
// ROLE: Tests for the Cursor rule files built from cursor-rules.json
// DEPENDS ON: lib/cursor.js, lib/sync.js, test/helpers.js
// USED BY: npm test, CI of the package
// KEY DECISIONS: the fixture mirrors Foundation's two scoped rules, the reference layout
// GOTCHAS: none
// LAST UPDATED: 2026-10-22 — first version
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { sync, plan, SyncError, PKG_ROOT } from '../lib/sync.js'
import { extractSection } from '../lib/cursor.js'
import { project } from './helpers.js'

const PATTERNS = `# PATTERNS — Pattern specifici dello stack

## Stack

- NestJS

## Componenti SolidJS

### Regole componente

- Una funzione named

## Store e Signals

- Uno store per dominio
`

// Writes the project's cursor-rules.json
const rules = (root, config) => writeFileSync(join(root, '.agent-guidelines', 'cursor-rules.json'), JSON.stringify(config))

const COMPONENTS = { file: 'components.mdc', description: 'Regole per i componenti SolidJS', globs: 'frontend/src/components/**/*.jsx', sections: ['Componenti SolidJS'] }

test('without a config base.mdc carries all of PATTERNS.md and no scoped rule exists', () => {
  const files = plan(project(PATTERNS))
  assert.match(files.get('.cursor/rules/base.mdc'), /## Componenti SolidJS/)
  assert.equal([...files.keys()].filter((rel) => rel.startsWith('.cursor/rules/')).length, 1)
})

test('scoped rules get their globs and whole sections, subsections included', () => {
  const root = project(PATTERNS)
  rules(root, { rules: [COMPONENTS] })
  const mdc = plan(root).get('.cursor/rules/components.mdc')
  assert.match(mdc, /^---\ndescription: Regole per i componenti SolidJS\nglobs: frontend\/src\/components\/\*\*\/\*\.jsx\nalwaysApply: true\n---\n\n<!-- GENERATED/)
  assert.match(mdc, /## Componenti SolidJS\n\n### Regole componente\n\n- Una funzione named\n$/)
  assert.doesNotMatch(mdc, /Store e Signals/)
})

test('base.patterns picks the PATTERNS.md sections that base.mdc carries, an empty list none', () => {
  const root = project(PATTERNS)
  rules(root, { base: { description: 'Regole base — architettura, naming, workflow', patterns: ['Stack'] }, rules: [COMPONENTS] })
  const base = plan(root).get('.cursor/rules/base.mdc')
  assert.match(base, /^---\ndescription: Regole base — architettura, naming, workflow\n/)
  assert.match(base, /## Stack/)
  assert.doesNotMatch(base, /## Componenti SolidJS/)
  rules(root, { base: { patterns: [] } })
  assert.doesNotMatch(plan(root).get('.cursor/rules/base.mdc'), /## Stack/)
})

test('a rule dropped from the config is removed by the next sync', () => {
  const root = project(PATTERNS)
  rules(root, { rules: [COMPONENTS] })
  sync(root)
  assert.ok(existsSync(join(root, '.cursor/rules/components.mdc')))
  rules(root, { rules: [] })
  sync(root)
  assert.equal(existsSync(join(root, '.cursor/rules/components.mdc')), false)
})

test('a missing section or a malformed rule fails the sync', () => {
  const root = project(PATTERNS)
  rules(root, { rules: [{ ...COMPONENTS, sections: ['Componenti React'] }] })
  assert.throws(() => sync(root), (error) => error instanceof SyncError && /Componenti React/.test(error.message))
  for (const bad of [{ ...COMPONENTS, file: 'base.mdc' }, { ...COMPONENTS, file: '../x.mdc' }, { ...COMPONENTS, sections: [] }, { ...COMPONENTS, globs: undefined }]) {
    rules(root, { rules: [bad] })
    assert.throws(() => sync(root), SyncError, JSON.stringify(bad))
  }
  rules(root, { rules: [COMPONENTS, COMPONENTS] })
  assert.throws(() => sync(root), /compare due volte/)
})

test('extractSection stops at the next level-2 heading only', () => {
  assert.equal(extractSection('## A\nx\n### B\ny\n## C\nz', 'A'), '## A\nx\n### B\ny')
  assert.equal(extractSection('## A\nx', 'A'), '## A\nx')
})

test('OpenSpec commands and skills ship for Cursor too', () => {
  const root = project(PATTERNS)
  sync(root)
  for (const rel of ['.cursor/commands/opsx-new.md', '.cursor/skills/openspec-apply-change/SKILL.md']) {
    assert.equal(readFileSync(join(root, rel), 'utf8'), readFileSync(join(PKG_ROOT, 'assets', 'files', rel), 'utf8'))
  }
})
