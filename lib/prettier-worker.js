// ============================================================
// ROLE: Formats managed files with the consuming project's own Prettier, in a child process
// DEPENDS ON: the project's prettier (resolved from its root), its config and .prettierignore
// USED BY: lib/format.js, which runs it with the files as JSON on stdin
// KEY DECISIONS: Prettier 3 is async while sync and the hooks are sync, so formatting runs
//   here and the caller waits on the process. Options come from the project config for each
//   file, the parser is fixed as Foundation's sync-agents.js did (markdown for .md and .mdc)
// GOTCHAS: Prettier is the project's, never the package's: the output must match what the
//   project's lint-staged would write. Ignored files come back unchanged
// LAST UPDATED: 2026-10-22 — first version
// ============================================================

import { readFileSync, existsSync } from 'fs'
import { createRequire } from 'module'
import { join } from 'path'
import { pathToFileURL } from 'url'

const { root, files } = JSON.parse(readFileSync(0, 'utf8'))
const prettierPath = createRequire(join(root, 'package.json')).resolve('prettier')
// The CommonJS entry resolved by require exposes the API under default when imported
const loaded = await import(pathToFileURL(prettierPath).href)
const prettier = typeof loaded.format === 'function' ? loaded : loaded.default
const ignorePath = ['.gitignore', '.prettierignore'].map((name) => join(root, name)).filter(existsSync)

// Parser for each managed extension
const PARSERS = { md: 'markdown', mdc: 'markdown', json: 'json' }

// Same content, parser and options format once: AGENTS.md and CLAUDE.md are the same text
const done = new Map()
const result = {}
for (const [rel, content] of files) {
  const path = join(root, rel)
  const { ignored } = await prettier.getFileInfo(path, { ignorePath })
  if (ignored) continue
  const options = { ...((await prettier.resolveConfig(path)) ?? {}), parser: PARSERS[rel.split('.').pop()] }
  const key = `${JSON.stringify(options)}\0${content}`
  if (!done.has(key)) done.set(key, await prettier.format(content, options))
  result[rel] = done.get(key)
}
process.stdout.write(JSON.stringify(result))
