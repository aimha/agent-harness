// ============================================================
// ROLE: Builds the Cursor rule files: base.mdc and the rules scoped to folders by globs
// DEPENDS ON: .agent-guidelines/cursor-rules.json (project, optional), the guidelines text
// USED BY: lib/sync.js (plan), test/cursor.test.js
// KEY DECISIONS: same layout Foundation's sync-agents.js produced: base.mdc always active,
//   one .mdc per rule with its globs, each made of whole "## " sections of PATTERNS.md.
//   The project chooses the sections; with no config, base.mdc carries all of PATTERNS.md
// GOTCHAS: a section is matched by its exact "## " heading and ends at the next "## ":
//   renaming a heading in PATTERNS.md without updating cursor-rules.json fails the sync,
//   on purpose, instead of writing a rule with nothing in it
// LAST UPDATED: 2026-10-22 — first version
// ============================================================

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export const CURSOR_RULES_FILE = '.agent-guidelines/cursor-rules.json'
const DEFAULT_BASE_DESCRIPTION = 'Regole base — architettura, naming, workflow, pattern'

// Error with a message meant for the person running the command
export class CursorRulesError extends Error {}

// Returns one "## " section of a markdown text, heading included
export function extractSection(markdown, heading) {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`)
  if (start === -1) throw new CursorRulesError(`${CURSOR_RULES_FILE}: sezione "## ${heading}" non trovata in PATTERNS.md`)
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '))
  return lines.slice(start, end === -1 ? lines.length : end).join('\n').trim()
}

// Reads and validates the project's Cursor rules config, or null when absent
export function readCursorRules(root) {
  const path = join(root, CURSOR_RULES_FILE)
  if (!existsSync(path)) return null
  let config
  try {
    config = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new CursorRulesError(`${CURSOR_RULES_FILE} non è JSON valido: ${error.message}`)
  }
  const rules = config.rules ?? []
  if (!Array.isArray(rules)) throw new CursorRulesError(`${CURSOR_RULES_FILE}: "rules" deve essere un elenco`)
  const seen = new Set()
  for (const rule of rules) {
    const valid =
      typeof rule.file === 'string' && /^[a-z0-9][a-z0-9-]*\.mdc$/.test(rule.file) && rule.file !== 'base.mdc' &&
      typeof rule.description === 'string' && typeof rule.globs === 'string' &&
      Array.isArray(rule.sections) && rule.sections.length > 0 && rule.sections.every((s) => typeof s === 'string')
    if (!valid) {
      throw new CursorRulesError(`${CURSOR_RULES_FILE}: ogni regola vuole file (kebab-case.mdc, non base.mdc), description, globs e sections non vuoto`)
    }
    if (seen.has(rule.file)) throw new CursorRulesError(`${CURSOR_RULES_FILE}: ${rule.file} compare due volte`)
    seen.add(rule.file)
  }
  const base = config.base ?? {}
  if (base.patterns !== undefined && !(Array.isArray(base.patterns) && base.patterns.every((s) => typeof s === 'string'))) {
    throw new CursorRulesError(`${CURSOR_RULES_FILE}: "base.patterns" deve essere un elenco di titoli di sezione`)
  }
  return { base, rules }
}

// Cursor rule files as path -> content, given the guideline parts and the banner
export function cursorFiles({ core, workflow, patterns }, banner, separator, config) {
  const files = new Map()
  const baseDescription = config?.base?.description ?? DEFAULT_BASE_DESCRIPTION
  const basePatterns = config?.base?.patterns
  const baseParts = [core, workflow]
  if (basePatterns === undefined) baseParts.push(patterns)
  else if (basePatterns.length) baseParts.push(basePatterns.map((heading) => extractSection(patterns, heading)).join('\n\n'))
  files.set('.cursor/rules/base.mdc', `---\ndescription: ${baseDescription}\nalwaysApply: true\n---\n\n${banner}${baseParts.join(separator)}\n`)

  for (const rule of config?.rules ?? []) {
    const body = rule.sections.map((heading) => extractSection(patterns, heading)).join('\n\n')
    files.set(`.cursor/rules/${rule.file}`, `---\ndescription: ${rule.description}\nglobs: ${rule.globs}\nalwaysApply: true\n---\n\n${banner}${body}\n`)
  }
  return files
}
