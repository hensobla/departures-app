#!/bin/bash
#
# tips-export.sh — convert src/tips.numbers → src/tips.csv via Numbers.app.
#
# `src/tips.numbers` is the source of truth for the in-session tip library;
# `src/tips.csv` is what the app reads at build time (Vite ?raw import).
# This script keeps the .csv in sync. It runs automatically as `predev` and
# `prebuild` (no-op when the .csv is already newer than the .numbers, so the
# usual dev cycle isn't slowed down by it).
#
# Behavior:
#   - Skips silently on non-macOS (CI uses the committed .csv as-is).
#   - Skips when src/tips.numbers is missing.
#   - Skips when src/tips.csv is up-to-date with src/tips.numbers.
#   - Otherwise drives Numbers.app via osascript to export to a temp path,
#     then atomically replaces src/tips.csv.
#
# Manual invocation: `npm run tips:export`.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
NUMBERS_FILE="$ROOT/src/tips.numbers"
CSV_FILE="$ROOT/src/tips.csv"

if [ "$(uname)" != "Darwin" ]; then
  exit 0
fi

if [ ! -f "$NUMBERS_FILE" ]; then
  exit 0
fi

if [ -f "$CSV_FILE" ] && [ ! "$NUMBERS_FILE" -nt "$CSV_FILE" ]; then
  exit 0
fi

echo "tips: exporting tips.numbers → tips.csv..."
TMPDIR="$(mktemp -d -t tips-export.XXXXXX)"
trap 'rm -rf "$TMPDIR"' EXIT

osascript <<APPLESCRIPT
set numbersPath to POSIX file "$NUMBERS_FILE"
set outPath to POSIX file "$TMPDIR/out"
tell application "Numbers"
  set theDoc to open numbersPath
  delay 0.5
  export theDoc to outPath as CSV
  close theDoc saving no
end tell
APPLESCRIPT

# Numbers may produce either a single file (1 sheet, 1 table) or a folder
# of CSVs (multiple sheets). Handle both.
RESULT=""
if [ -f "$TMPDIR/out" ]; then
  RESULT="$TMPDIR/out"
elif [ -f "$TMPDIR/out.csv" ]; then
  RESULT="$TMPDIR/out.csv"
elif [ -d "$TMPDIR/out" ]; then
  RESULT="$(find "$TMPDIR/out" -name '*.csv' -print -quit)"
fi

if [ -z "$RESULT" ] || [ ! -f "$RESULT" ]; then
  echo "tips: export failed — Numbers produced no CSV" >&2
  exit 1
fi

mv "$RESULT" "$CSV_FILE"
echo "tips: wrote $CSV_FILE ($(wc -l < "$CSV_FILE" | tr -d ' ') lines)"
