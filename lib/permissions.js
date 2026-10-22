// ============================================================
// ROLE: Evaluates OpenCode permission rules the way OpenCode does, for gates outside OpenCode
// DEPENDS ON: the composed opencode.json permission object (lib/sync.js composeOpencode)
// USED BY: lib/hooks.js (protected files on ai/ branches), lib/sync.js (protected list in
//   the guidelines), test/permissions.test.js
// KEY DECISIONS: one source for protected files: the edit rules of opencode.json. match()
//   is a copy of OpenCode v1.19.3 util/wildcard.ts, evaluate() of its Permission.evaluate:
//   rules in config order, last match wins, no match means ask
// GOTCHAS: '*' becomes '.*' and crosses folders, so '.github/*' covers every file below it.
//   A trailing ' *' also matches the bare command ('ls *' matches 'ls'). Keep in step
//   with OpenCode when it changes its matcher
// LAST UPDATED: 2026-10-22 — first version
// ============================================================

// Matches a path or command against an OpenCode wildcard pattern
export function match(input, pattern) {
  const str = input.replaceAll('\\', '/')
  let escaped = pattern
    .replaceAll('\\', '/')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  if (escaped.endsWith(' .*')) escaped = `${escaped.slice(0, -3)}( .*)?`
  return new RegExp(`^${escaped}$`, 's').test(str)
}

// Action OpenCode applies to one permission and input under a permission config
export function evaluate(permissionConfig, permission, input) {
  const rules = permissionConfig?.[permission]
  if (typeof rules === 'string') return rules
  if (!rules) return 'ask'
  let action = 'ask'
  for (const [pattern, value] of Object.entries(rules)) if (match(input, pattern)) action = value
  return action
}

// Edit rules split into the protected patterns and the exceptions allowed after them
export function protectedRules(permissionConfig) {
  const rules = Object.entries(permissionConfig?.edit ?? {}).filter(([pattern]) => pattern !== '*')
  return {
    denied: rules.filter(([, action]) => action === 'deny').map(([pattern]) => pattern),
    allowed: rules.filter(([, action]) => action === 'allow').map(([pattern]) => pattern),
  }
}
