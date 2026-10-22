#!/usr/bin/env node
// ============================================================
// ROLE: Generates the OpenSpec commands and skills shipped in assets/files/.opencode and .cursor
// DEPENDS ON: @fission-ai/openspec (pinned dependency), assets/openspec/profile.json
// USED BY: npm run openspec-assets (after an OpenSpec upgrade or a profile change),
//   test/openspec-assets.test.js (--check)
// KEY DECISIONS: the output does not depend on the project, so it is generated once here
//   instead of running openspec update in every project; XDG_CONFIG_HOME points to a temp
//   dir, so the machine-wide OpenSpec profile of whoever runs this is never touched
// GOTCHAS: only opsx-* commands and openspec-* skills are replaced: grill, update-context,
//   grilling and domain-modeling live in the same folders and must survive
// LAST UPDATED: 2026-10-22 — Cursor commands and skills too
// ============================================================

import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { openspecCli } from '../lib/deps.js'

const PKG_ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const FILES = join(PKG_ROOT, 'assets', 'files')

// Tool folders OpenSpec generates into, one per supported agent
const TOOLS = { opencode: '.opencode', cursor: '.cursor' }
const { workflows } = JSON.parse(readFileSync(join(PKG_ROOT, 'assets', 'openspec', 'profile.json'), 'utf8'))

// Folder entries owned by OpenSpec inside .opencode/commands and .opencode/skills
const OWNED = { commands: (name) => name.startsWith('opsx-'), skills: (name) => name.startsWith('openspec-') }

// Lists files under a folder as relative posix paths
function files(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1).replaceAll('\\', '/'))
    .sort()
}

// Runs the pinned CLI in a throwaway project and returns path -> content of what it generated, paths relative to assets/files
function generate() {
  const work = mkdtempSync(join(tmpdir(), 'openspec-assets-'))
  try {
    const env = { ...process.env, XDG_CONFIG_HOME: join(work, 'config'), OPENSPEC_TELEMETRY: '0' }
    const run = (args, cwd = work) => execFileSync(process.execPath, [openspecCli(), ...args], { cwd, env, stdio: 'pipe' })
    run(['config', 'set', 'telemetry.enabled', 'false'])
    run(['config', 'set', 'profile', 'custom'])
    run(['config', 'set', 'workflows', JSON.stringify(workflows)])
    const project = join(work, 'project')
    mkdirSync(project)
    run(['init', '--tools', Object.keys(TOOLS).join(','), '--no-animation', '--no-copilot-cloud', '.'], project)
    const generated = new Map()
    for (const folder of Object.values(TOOLS)) {
      const out = join(project, folder)
      for (const rel of files(out)) generated.set(`${folder}/${rel}`, readFileSync(join(out, rel), 'utf8'))
    }
    return generated
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

// Current OpenSpec-owned files in the assets, as path -> content, paths relative to assets/files
function current() {
  const owned = new Map()
  for (const folder of Object.values(TOOLS)) {
    const dir = join(FILES, folder)
    if (!existsSync(dir)) continue
    for (const rel of files(dir)) {
      const [kind, name] = rel.split('/')
      if (OWNED[kind]?.(name)) owned.set(`${folder}/${rel}`, readFileSync(join(dir, rel), 'utf8'))
    }
  }
  return owned
}

const expected = generate()
const actual = current()
const differs = [...new Set([...expected.keys(), ...actual.keys()])].filter((rel) => expected.get(rel) !== actual.get(rel))

if (process.argv.includes('--check')) {
  if (differs.length) {
    console.error(`❌  File OpenSpec negli asset non allineati alla CLI pinnata e al profilo ${JSON.stringify(workflows)}:`)
    for (const rel of differs) console.error(`  ✗  ${rel}`)
    console.error('    Eseguire: npm run openspec-assets')
    process.exit(1)
  }
  console.log(`✅  File OpenSpec allineati (${expected.size} file, profilo ${JSON.stringify(workflows)})`)
  process.exit(0)
}

for (const rel of actual.keys()) if (!expected.has(rel)) rmSync(join(FILES, rel))
for (const [rel, content] of expected) {
  mkdirSync(join(FILES, rel, '..'), { recursive: true })
  writeFileSync(join(FILES, rel), content)
}
console.log(differs.length ? `✅  Aggiornati ${differs.length} file OpenSpec` : '✅  Già allineati')
