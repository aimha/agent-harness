// ============================================================
// ROLE: Locates the package's own dependencies and the versions it pins
// DEPENDS ON: package.json (dependencies), node_modules layout
// USED BY: bin/cli.js, lib/hooks.js, scripts/openspec-assets.js
// KEY DECISIONS: dependencies are found by walking up node_modules from the package, the
//   same way Node resolves them, so they work whether npm hoists them or nests them
// GOTCHAS: OpenSpec exports only ".", so require.resolve of its package.json throws:
//   resolution goes through the file system, not through the exports map
// LAST UPDATED: 2026-10-22 - first version
// ============================================================

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Error raised when a dependency the package needs cannot be found
export class MissingDependencyError extends Error {}

// Finds the folder of an installed dependency, searching upward like Node does
export function dependencyDir(name, from = PKG_ROOT) {
  let dir = from
  while (true) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    const parent = dirname(dir)
    if (parent === dir) throw new MissingDependencyError(`Dipendenza non trovata: ${name}. Eseguire npm ci`)
    dir = parent
  }
}

// Absolute path of the JS entry of a dependency's bin
export function binPath(name, bin) {
  const dir = dependencyDir(name)
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const entry = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[bin]
  if (!entry) throw new MissingDependencyError(`${name} non espone il comando ${bin}`)
  return join(dir, entry)
}

// Path of the pinned OpenSpec CLI
export const openspecCli = () => binPath('@fission-ai/openspec', 'openspec')

// Path of the pinned commitlint CLI
export const commitlintCli = () => binPath('@commitlint/cli', 'commitlint')

// Version of a dependency as pinned in the package's package.json
export function pinnedVersion(name) {
  return JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')).dependencies[name]
}

// Version of a dependency installed at the top of a project's node_modules, or null
export function projectVersion(root, name) {
  const path = join(root, 'node_modules', name, 'package.json')
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).version : null
}

// Explains why npx openspec in the project would not run the pinned OpenSpec, or null
export function openspecMismatch(root) {
  const name = '@fission-ai/openspec'
  const pinned = pinnedVersion(name)
  const found = projectVersion(root, name)
  if (found === pinned) return null
  const what = found ? `trova la versione ${found}` : 'non la trova in node_modules'
  return `npx openspec nel progetto ${what}, ma agent-harness usa la ${pinned}: rimuovere ${name} dalle dipendenze del progetto e rieseguire npm install`
}
