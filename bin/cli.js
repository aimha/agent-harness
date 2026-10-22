#!/usr/bin/env node
// ============================================================
// ROLE: Command-line entry point of the package, dispatches subcommands
// DEPENDS ON: lib/sync.js, package.json (version)
// USED BY: consuming projects via npx agent-harness <command>
// KEY DECISIONS: plain ESM with no dependencies and no build step, so a git-tag
//   install works without compiling anything
// GOTCHAS: the project is found from where the package is installed, not from cwd:
//   running npx from a subfolder still targets the project root
// LAST UPDATED: 2026-10-22 - sync and sync --check
// ============================================================

import { sync, projectRoot, packageVersion, SyncError, LOCK_FILE } from '../lib/sync.js'

const version = packageVersion()

const HELP = `agent-harness ${version}

Uso: npx agent-harness <comando>

Comandi:
  sync           genera i file gestiti dal pacchetto nel progetto
  sync --check   controlla che siano allineati, senza scrivere (CI e pre-commit)
  help           mostra questo aiuto
  version        mostra la versione installata
`

// Writes or checks the managed files and reports what differs
function runSync(args) {
  const check = args.includes('--check')
  const root = projectRoot()
  const { stale, orphans, lockVersion } = sync(root, { check })

  if (!check) {
    for (const rel of stale) console.log(`  ✓  ${rel}`)
    for (const rel of orphans) console.log(`  ✗  ${rel} rimosso: non più fornito dal pacchetto`)
    console.log(stale.length + orphans.length ? `\n✅  sync completato (agent-harness ${version})` : `✅  già allineato (agent-harness ${version})`)
    return 0
  }

  if (!stale.length && !orphans.length) {
    console.log(`✅  file gestiti allineati (agent-harness ${version})`)
    return 0
  }
  for (const rel of stale) console.error(`  ✗  ${rel} non allineato`)
  for (const rel of orphans) console.error(`  ✗  ${rel} non più fornito dal pacchetto`)
  if (lockVersion && lockVersion !== version) {
    console.error(`\n    ${LOCK_FILE} indica la versione ${lockVersion}, quella installata è ${version}`)
  }
  console.error('\n❌  File gestiti non allineati: esegui npx agent-harness sync e committa.')
  console.error('    Le modifiche locali vanno in .agent-guidelines/PATTERNS.md o in opencode.local.json.')
  return 1
}

// Subcommand table: name -> handler returning the exit code
const COMMANDS = {
  sync: runSync,
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
  if (!(error instanceof SyncError)) throw error
  console.error(`❌  ${error.message}`)
  process.exit(1)
}
