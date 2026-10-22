#!/usr/bin/env bash
# ============================================================
# ROLE: PR gate for the OpenSpec flow, driven by the branch prefix and the PR content
# DEPENDS ON: git, openspec/ and docs/summaries/ layout
# USED BY: agent-harness check-flow, called by agent-harness.yml (pull_request only);
#   lib/hooks.js pre-push (--name)
# KEY DECISIONS: spec/<name> holds only the change of the same name (+ GLOSSARY.md and
#   docs/adr/), must have tasks.md and docs-only commits; ai/<name> needs its summary
#   in docs/summaries/ai/<name>.md and its change archived. Every agent summary in the
#   PR range needs its change archived whatever the head branch, so a branch chain
#   that ends on fix/ or feature/ cannot skip the archive. develop -> main (and back)
#   is the integration PR between the two long-lived branches.
#   revert-<n>- branches from the GitHub Revert button pass the name check and get
#   only the summary check. With --name <branch> it checks the name alone (pre-push)
# GOTCHAS: <name> must match the OpenSpec change name. feature/, fix/ and chore/ only
#   check the branch name and the summaries they carry. Editing an agent summary
#   whose change was never archived fails the gate.
#   PREFIXES drives both the regex and the error message: extend it in one place.
#   Runs with the project root as cwd: every path is relative to the project.
# LAST UPDATED: 2026-10-22 — revert branches, name-only mode for pre-push
# ============================================================
set -euo pipefail

# Branch prefixes accepted by the flow
PREFIXES="ai|spec|feature|fix|chore"

# Long-lived branches: a PR between them is an integration PR
LONG_LIVED="main|develop"

# Branches the GitHub Revert button creates: revert-<PR number>-<reverted branch>
REVERT="revert-[0-9]+-.+"

# Fail with a readable message
fail() {
  printf '❌  %b\n' "$1"
  exit 1
}

# Fails unless the flow accepts the branch name; sets PREFIX and NAME
check_name() {
  local branch="$1"
  if [[ "$branch" =~ ^($LONG_LIVED)$ ]]; then
    PREFIX="$branch"
    NAME=""
  elif [[ "$branch" =~ ^$REVERT$ ]]; then
    PREFIX="revert"
    NAME=""
  else
    [[ "$branch" =~ ^($PREFIXES)/[a-z0-9][a-z0-9-]*$ ]] \
      || fail "Nome branch non conforme: $branch\n    Atteso: <$PREFIXES>/<kebab-case>"
    PREFIX="${branch%%/*}"
    NAME="${branch#*/}"
  fi
}

# Name-only mode, used by the pre-push hook: the same rule, before the PR exists
if [ "${1:-}" = "--name" ]; then
  check_name "${2:-}"
  exit 0
fi

BRANCH="$1"
BASE_SHA="$2"
HEAD_SHA="$3"
BASE_BRANCH="${4:-}"

# Fails unless the change has been archived through the CLI
assert_archived() {
  local name="$1"
  [ ! -d "openspec/changes/$name" ] \
    || fail "Change $name non archiviato: eseguire npx openspec archive $name --yes prima del merge (passo 8)"
  ls openspec/changes/archive 2>/dev/null | grep -qE "^[0-9]{4}-[0-9]{2}-[0-9]{2}-$name$" \
    || fail "Nessun change archiviato con nome $name in openspec/changes/archive/"
}

check_name "$BRANCH"
if [[ "$PREFIX" =~ ^($LONG_LIVED)$ ]]; then
  [[ "$BASE_BRANCH" =~ ^($LONG_LIVED)$ && "$BASE_BRANCH" != "$BRANCH" ]] \
    || fail "Il branch $BRANCH si mergia solo nell'altro branch principale (main o develop)"
fi

CHANGED=$(git diff --name-only "$BASE_SHA"..."$HEAD_SHA")

case "$PREFIX" in
  spec)
    [ -d "openspec/changes/$NAME" ] \
      || fail "Manca openspec/changes/$NAME: il branch spec/ contiene il change con lo stesso nome"
    [ -f "openspec/changes/$NAME/tasks.md" ] \
      || fail "Manca openspec/changes/$NAME/tasks.md: la PR della spec si mergia dopo il piano (passo 5)"
    OUTSIDE=$(printf '%s\n' "$CHANGED" | grep -vE "^(openspec/changes/$NAME/|GLOSSARY\.md$|docs/adr/)" || true)
    [ -z "$OUTSIDE" ] \
      || fail "La PR della spec modifica file fuori dal change:\n$OUTSIDE"
    NOT_DOCS=$(git log --no-merges --format='%h %s' "$BASE_SHA".."$HEAD_SHA" | grep -vE '^[0-9a-f]+ docs(\([a-z0-9-]+\))?!?: ' || true)
    [ -z "$NOT_DOCS" ] \
      || fail "Sui branch spec/ sono ammessi solo commit di tipo docs:\n$NOT_DOCS"
    ;;
  ai)
    [ -f "docs/summaries/ai/$NAME.md" ] \
      || fail "Manca il summary docs/summaries/ai/$NAME.md"
    assert_archived "$NAME"
    ;;
esac

# Every agent summary added or changed in the PR needs its change archived
SUMMARIES=$(printf '%s\n' "$CHANGED" | sed -nE 's|^docs/summaries/ai/([a-z0-9][a-z0-9-]*)\.md$|\1|p' | sort -u)
for SUMMARY in $SUMMARIES; do
  [ -f "docs/summaries/ai/$SUMMARY.md" ] || continue
  assert_archived "$SUMMARY"
done

echo "✅  Flusso rispettato per $BRANCH"
