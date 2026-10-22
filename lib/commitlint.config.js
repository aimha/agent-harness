// ============================================================
// ROLE: Commitlint rules based on Conventional Commits with a restricted type-enum
// DEPENDS ON: @commitlint/config-conventional
// USED BY: agent-harness commitlint (commit-msg hook, CI commit message step)
// KEY DECISIONS: type-enum drops perf and revert from the conventional default, as Foundation does;
//   the config lives in the package and is passed with --config, so projects keep no copy
// GOTCHAS: subject-case lower-case rejects subjects with capitals, library names included.
//   extends is resolved from this file's folder, i.e. from the package's dependencies
// LAST UPDATED: 2026-10-22 - build type allowed, as in Foundation
// ============================================================

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'style', 'test', 'docs', 'chore', 'ci', 'build']],
    'type-case': [2, 'always', 'lower-case'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
  },
}
