#!/usr/bin/env node
// ============================================================
// ROLE: Command-line entry point of the package, dispatches subcommands
// DEPENDS ON: package.json (version)
// USED BY: consuming projects via npx agent-harness <command>
// KEY DECISIONS: plain ESM with no dependencies and no build step, so a git-tag
//   install works without compiling anything
// GOTCHAS: paths are resolved from this file, never from process.cwd(): cwd is the
//   consuming project, the package lives in its node_modules
// LAST UPDATED: 2026-10-21 - first version: help and version only
// ============================================================

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'))

const HELP = `agent-harness ${version}

Uso: npx agent-harness <comando>

Comandi:
  help       mostra questo aiuto
  version    mostra la versione installata
`

// Subcommand table: name -> handler returning the exit code
const COMMANDS = {
  help: () => {
    process.stdout.write(HELP)
    return 0
  },
  version: () => {
    console.log(version)
    return 0
  },
}

const [name = 'help'] = process.argv.slice(2)
const command = COMMANDS[name === '--version' ? 'version' : name === '--help' ? 'help' : name]

if (!command) {
  console.error(`❌  Comando sconosciuto: ${name}\n`)
  process.stderr.write(HELP)
  process.exit(1)
}

process.exit(command())
