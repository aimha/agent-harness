#!/usr/bin/env bash
# ============================================================
# ROLE: PR gate for the OpenSpec flow, driven by the branch prefix
# DEPENDS ON: git, openspec/ and docs/summaries/ layout
# USED BY: agent-harness check-flow, called by ci.yml (checks job, pull_request only)
# KEY DECISIONS: spec/<name> holds only the change of the same name (+ GLOSSARY.md and
#   docs/adr/), must have tasks.md and docs-only commits; ai/<name> must reach the merge
#   with the change archived via the CLI and the summary in place
# GOTCHAS: <name> must match the OpenSpec change name.
#   feature/, fix/ and chore/ only check the branch name.
#   PREFIXES drives both the regex and the error message: extend it in one place.
#   Runs with the project root as cwd: every path is relative to the project.
# LAST UPDATED: 2026-10-22 - moved from the template into the package
# ============================================================
set -euo pipefail

BRANCH="$1"
BASE_SHA="$2"
HEAD_SHA="$3"

# Branch prefixes accepted by the flow
PREFIXES="ai|spec|feature|fix|chore"

# Fail with a readable message
fail() {
  printf '❌  %b\n' "$1"
  exit 1
}

[[ "$BRANCH" =~ ^($PREFIXES)/[a-z0-9][a-z0-9-]*$ ]] \
  || fail "Nome branch non conforme: $BRANCH\n    Atteso: <$PREFIXES>/<kebab-case>"

PREFIX="${BRANCH%%/*}"
NAME="${BRANCH#*/}"
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
    [ ! -d "openspec/changes/$NAME" ] \
      || fail "Change $NAME non archiviato: eseguire npx openspec archive $NAME --yes prima del merge (passo 8)"
    ls openspec/changes/archive 2>/dev/null | grep -qE "^[0-9]{4}-[0-9]{2}-[0-9]{2}-$NAME$" \
      || fail "Nessun change archiviato con nome $NAME in openspec/changes/archive/"
    [ -f "docs/summaries/$NAME.md" ] \
      || fail "Manca il summary docs/summaries/$NAME.md"
    ;;
esac

echo "✅  Flusso rispettato per $BRANCH"
