#!/usr/bin/env node
// ============================================================
// ROLE: Generates the OpenSpec commands and skills shipped in assets/files/.opencode
// DEPENDS ON: @fission-ai/openspec (pinned dependency), assets/openspec/profile.json
// USED BY: npm run openspec-assets (after an OpenSpec upgrade or a profile change),
//   test/openspec-assets.test.js (--check)
// KEY DECISIONS: the output does not depend on the project, so it is generated once here
//   instead of running openspec update in every project; XDG_CONFIG_HOME points to a temp
//   dir, so the machine-wide OpenSpec profile of whoever runs this is never touched
// GOTCHAS: only opsx-* commands and openspec-* skills are replaced: grill, update-context,
//   grilling and domain-modeling live in the same folders and must survive
// LAST UPDATED: 2026-10-22 - first version
// ============================================================

import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { openspecCli } from '../lib/deps.js'

const PKG_ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const TARGET = join(PKG_ROOT, 'assets', 'files', '.opencode')
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

// Runs the pinned CLI in a throwaway project and returns path -> content of what it generated
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
    run(['init', '--tools', 'opencode', '--no-animation', '--no-copilot-cloud', '.'], project)
    const out = join(project, '.opencode')
    return new Map(files(out).map((rel) => [rel, readFileSync(join(out, rel), 'utf8')]))
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

// Current OpenSpec-owned files in the assets, as path -> content
function current() {
  if (!existsSync(TARGET)) return new Map()
  return new Map(
    files(TARGET)
      .filter((rel) => {
        const [folder, name] = rel.split('/')
        return OWNED[folder]?.(name)
      })
      .map((rel) => [rel, readFileSync(join(TARGET, rel), 'utf8')]),
  )
}

const expected = generate()
const actual = current()
const differs = [...new Set([...expected.keys(), ...actual.keys()])].filter((rel) => expected.get(rel) !== actual.get(rel))

if (process.argv.includes('--check')) {
  if (differs.length) {
    console.error(`❌  File OpenSpec negli asset non allineati alla CLI pinnata e al profilo ${JSON.stringify(workflows)}:`)
    for (const rel of differs) console.error(`  ✗  .opencode/${rel}`)
    console.error('    Eseguire: npm run openspec-assets')
    process.exit(1)
  }
  console.log(`✅  File OpenSpec allineati (${expected.size} file, profilo ${JSON.stringify(workflows)})`)
  process.exit(0)
}

for (const rel of actual.keys()) if (!expected.has(rel)) rmSync(join(TARGET, rel))
for (const [rel, content] of expected) {
  mkdirSync(join(TARGET, rel, '..'), { recursive: true })
  writeFileSync(join(TARGET, rel), content)
}
console.log(differs.length ? `✅  Aggiornati ${differs.length} file OpenSpec` : '✅  Già allineati')
