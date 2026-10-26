#!/usr/bin/env bash
# Diagram generators check (CLAUDE.md: diagrams are never hand-edited — change
# the generator in docs/design/diagrams/scripts/ and rerun it).
#
#   scripts/check-diagrams.sh   Runs each generator on its own over the pages as
#                               staged, and fails when one changes anything.
#
# A change means a page no longer matches what generates it: it was edited by
# hand, its generator changed without being rerun, an older generator rolls back
# a page a later one took over (each page has exactly one writer), or a
# generator isn't idempotent. Each run is undone before the next, so every
# generator is checked alone, in any order.
#
# The pages are restored from the index, so unstaged changes under the diagrams
# are refused up front rather than lost: stage or stash them first.
set -u
cd "$(dirname "$0")/.." || exit 1
DIAGRAMS=docs/design/diagrams
SCRIPTS=$DIAGRAMS/scripts

# Lists what differs from the index under the diagrams: changed, removed or new files.
changes() {
  git diff --name-only -- "$DIAGRAMS"
  git ls-files --others --exclude-standard -- "$DIAGRAMS"
}

# Puts the diagrams back as staged, new files removed.
restore() {
  git checkout --quiet -- "$DIAGRAMS"
  git ls-files --others --exclude-standard -z -- "$DIAGRAMS" | xargs -0 -r rm -f
}

if [ -n "$(changes)" ]; then
  echo "check:diagrams: unstaged changes under $DIAGRAMS — stage or stash them first:"
  changes | sed 's/^/    /'
  exit 1
fi

failed=0
for generator in "$SCRIPTS"/gen_*.py; do
  name=$(basename "$generator")
  case $name in *_lib.py) continue ;; esac
  if ! output=$(cd "$SCRIPTS" && python3 "$name" 2>&1); then
    echo "✗ $name failed:"
    echo "$output" | sed 's/^/    /'
    failed=1
  fi
  changed=$(changes)
  if [ -n "$changed" ]; then
    echo "✗ $name changes pages (hand-edited, not regenerated, or owned by another generator):"
    echo "$changed" | sed 's/^/    /'
    failed=1
  fi
  restore
done

[ "$failed" -eq 0 ] && echo "check:diagrams: every generator reproduces the pages as they are"
exit "$failed"
