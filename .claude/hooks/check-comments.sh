#!/bin/bash
# Post-edit hook: checks comment quality on files Claude just edited.
# Runs on PostToolUse for Edit and Write.
# Exit 0 always (warnings only, never blocks) — Claude sees stdout and can fix issues.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Only check JavaScript files
if [[ "$FILE_PATH" != *.js && "$FILE_PATH" != *.mjs ]]; then
  exit 0
fi

WARNINGS=()

# ── Lambda header check ──────────────────────────────────────────
# Lambda files (in lambda/ directory) must have a header block describing
# routes, auth, env vars. Check for the required fields.
if [[ "$FILE_PATH" == *lambda/*.js || "$FILE_PATH" == *lambda/*.mjs ]]; then
  FILENAME=$(basename "$FILE_PATH")

  # Check for any header comment in the first 15 lines
  HEAD=$(head -15 "$FILE_PATH")

  if ! echo "$HEAD" | grep -qiE '(lambda|route|auth|env)'; then
    WARNINGS+=("Lambda file '$FILENAME' is missing a header block. Required: Lambda name, routes, auth method, env vars.")
  else
    # Check for specific required fields
    if ! echo "$HEAD" | grep -qiE '(route|path|GET|POST|PUT|DELETE)'; then
      WARNINGS+=("Lambda file '$FILENAME' header: missing route information (e.g., POST /save, GET /groups)")
    fi
    if ! echo "$HEAD" | grep -qi 'auth'; then
      WARNINGS+=("Lambda file '$FILENAME' header: missing auth method (e.g., 'Auth: Cognito authorizer')")
    fi
    if ! echo "$HEAD" | grep -qiE '(env|environment)'; then
      WARNINGS+=("Lambda file '$FILENAME' header: missing environment variables (e.g., 'Environment variables: ANTHROPIC_API_KEY')")
    fi
  fi
fi

# ── General comment quality checks ──────────────────────────────
TOTAL_LINES=$(wc -l < "$FILE_PATH")

# Count comment lines (// and /* style)
COMMENT_LINES=$(grep -cE '^\s*(//|/\*|\*)' "$FILE_PATH" 2>/dev/null || echo "0")

# Check comment ratio for files over 30 lines
if [ "$TOTAL_LINES" -gt 30 ]; then
  RATIO=$(python3 -c "print(round($COMMENT_LINES / $TOTAL_LINES * 100, 1))" 2>/dev/null)
  if [ "$(python3 -c "print(1 if $COMMENT_LINES / $TOTAL_LINES < 0.05 else 0)")" = "1" ]; then
    WARNINGS+=("Low comment density (${RATIO}% of ${TOTAL_LINES} lines). Consider adding comments to explain non-obvious logic.")
  fi
fi

# Check for section dividers in files over 80 lines (project convention: // ── Section ───)
if [ "$TOTAL_LINES" -gt 80 ]; then
  DIVIDERS=$(grep -cE '// ──' "$FILE_PATH" 2>/dev/null || echo "0")
  if [ "$DIVIDERS" -eq 0 ]; then
    WARNINGS+=("File is ${TOTAL_LINES} lines with no section dividers. Use '// ── Section name ───' to separate logical sections.")
  fi
fi

# Check for unresolved TODOs or FIXMEs
TODO_COUNT=$(grep -ciE '\b(TODO|FIXME|HACK|XXX)\b' "$FILE_PATH" 2>/dev/null || echo "0")
if [ "$TODO_COUNT" -gt 0 ]; then
  TODOS=$(grep -niE '\b(TODO|FIXME|HACK|XXX)\b' "$FILE_PATH" 2>/dev/null)
  WARNINGS+=("Found ${TODO_COUNT} unresolved TODO/FIXME comment(s):\n${TODOS}")
fi

# ── Report ───────────────────────────────────────────────────────
if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "Comment quality check for $(basename "$FILE_PATH"):"
  for warning in "${WARNINGS[@]}"; do
    echo -e "  ⚠ $warning"
  done
  echo ""
  echo "These are suggestions, not blockers. Fix them if appropriate."
fi

exit 0
