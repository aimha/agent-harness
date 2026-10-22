#!/usr/bin/env node
// ============================================================
// ROLE: Command-line entry point of the package, dispatches subcommands
// DEPENDS ON: lib/sync.js, lib/hooks.js, lib/deps.js, lib/check-flow.sh
// USED BY: consuming projects via npx agent-harness <command>: Husky hooks, CI, people
// KEY DECISIONS: plain ESM with no build step, so a git-tag install works without
//   compiling anything. openspec and commitlint run from the package's own dependencies,
//   never through npx, so the pinned versions are the ones that run
// GOTCHAS: the project is found from where the package is installed, not from cwd:
//   running npx from a subfolder still targets the project root
// LAST UPDATED: 2026-10-22 - hooks, check-flow, commitlint and openspec commands
// ============================================================

import { spawnSync } from 'child_process'
import { join } from 'path'
import { readFileSync } from 'fs'
import { sync, projectRoot, packageVersion, SyncError, LOCK_FILE, PKG_ROOT } from '../lib/sync.js'
import { preCommit, prePush, commitlint } from '../lib/hooks.js'
import { openspecCli, openspecMismatch, MissingDependencyError } from '../lib/deps.js'

const version = packageVersion()

const HELP = `agent-harness ${version}

Uso: npx agent-harness <comando>

Comandi:
  sync                          genera i file gestiti dal pacchetto nel progetto
  sync --check                  controlla che siano allineati, senza scrivere
  check-flow <branch> <base> <head>
                                controlla il flusso OpenSpec di una PR (CI)
  commitlint [opzioni]          commitlint con le regole del pacchetto (CI)
  openspec [argomenti]          la CLI OpenSpec nella versione del pacchetto
  hook pre-commit|pre-push|commit-msg
                                controlli degli hook git (chiamati da .husky/)
  help                          mostra questo aiuto
  version                       mostra la versione installata
`

// Prints problems found by a check and returns the exit code
function report(problems) {
  for (const problem of problems) console.error(`❌  ${problem}`)
  return problems.length ? 1 : 0
}

// Writes or checks the managed files and reports what differs
function runSync(args) {
  const check = args.includes('--check')
  const root = projectRoot()
  const { stale, orphans, lockVersion } = sync(root, { check })
  const mismatch = openspecMismatch(root)

  if (!check) {
    for (const rel of stale) console.log(`  ✓  ${rel}`)
    for (const rel of orphans) console.log(`  ✗  ${rel} rimosso: non più fornito dal pacchetto`)
    console.log(stale.length + orphans.length ? `\n✅  sync completato (agent-harness ${version})` : `✅  già allineato (agent-harness ${version})`)
    if (mismatch) console.error(`\n⚠️   ${mismatch}`)
    return 0
  }

  if (!stale.length && !orphans.length && !mismatch) {
    console.log(`✅  file gestiti allineati (agent-harness ${version})`)
    return 0
  }
  for (const rel of stale) console.error(`  ✗  ${rel} non allineato`)
  for (const rel of orphans) console.error(`  ✗  ${rel} non più fornito dal pacchetto`)
  if (lockVersion && lockVersion !== version) {
    console.error(`\n    ${LOCK_FILE} indica la versione ${lockVersion}, quella installata è ${version}`)
  }
  if (stale.length || orphans.length) {
    console.error('\n❌  File gestiti non allineati: esegui npx agent-harness sync e committa.')
    console.error('    Le modifiche locali vanno in .agent-guidelines/PATTERNS.md o in opencode.local.json.')
  }
  if (mismatch) console.error(`\n❌  ${mismatch}`)
  return 1
}

// Runs a git hook check by name
function runHook([name, ...args]) {
  const root = projectRoot()
  if (name === 'pre-commit') return report(preCommit(root))
  if (name === 'pre-push') return report(prePush(root, process.stdin.isTTY ? '' : readFileSync(0, 'utf8')))
  if (name === 'commit-msg') return commitlint(root, ['--edit', args[0] ?? '.git/COMMIT_EDITMSG'])
  console.error(`❌  Hook sconosciuto: ${name ?? '(nessuno)'}. Validi: pre-commit, pre-push, commit-msg`)
  return 1
}

// Runs the flow gate script from the project root
function runCheckFlow(args) {
  if (args.length !== 3) {
    console.error('❌  Uso: agent-harness check-flow <branch> <base-sha> <head-sha>')
    return 1
  }
  const script = join(PKG_ROOT, 'lib', 'check-flow.sh')
  return spawnSync('bash', [script, ...args], { cwd: projectRoot(), stdio: 'inherit' }).status ?? 1
}

// Runs the pinned OpenSpec CLI with telemetry off
function runOpenspec(args) {
  const env = { ...process.env, OPENSPEC_TELEMETRY: '0' }
  return spawnSync(process.execPath, [openspecCli(), ...args], { cwd: projectRoot(), stdio: 'inherit', env }).status ?? 1
}

// Subcommand table: name -> handler returning the exit code
const COMMANDS = {
  sync: runSync,
  hook: runHook,
  'check-flow': runCheckFlow,
  commitlint: (args) => commitlint(projectRoot(), args),
  openspec: runOpenspec,
  help: () => {
    process.stdout.write(HELP)
    return 0
  },
  version: () => {
    console.log(version)
    return 0
  },
}

const ALIASES = { '--help': 'help', '-h': 'help', '--version': 'version', '-v': 'version' }

const [name = 'help', ...args] = process.argv.slice(2)
const command = COMMANDS[ALIASES[name] ?? name]

if (!command) {
  console.error(`❌  Comando sconosciuto: ${name}\n`)
  process.stderr.write(HELP)
  process.exit(1)
}

try {
  process.exit(command(args))
} catch (error) {
  if (!(error instanceof SyncError) && !(error instanceof MissingDependencyError)) throw error
  console.error(`❌  ${error.message}`)
  process.exit(1)
}
