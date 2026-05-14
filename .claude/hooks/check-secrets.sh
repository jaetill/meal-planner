#!/bin/bash
# Pre-commit hook: scans staged content for hardcoded secrets.
# Runs on PreToolUse for Bash commands that look like git commit.
# Exit 2 = block the commit and show the error message.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

# Only check git commit commands
if ! echo "$COMMAND" | grep -qE 'git\s+commit'; then
  exit 0
fi

# Get the staged diff
DIFF=$(git diff --cached --diff-filter=ACMR 2>/dev/null)

if [ -z "$DIFF" ]; then
  exit 0
fi

ISSUES=()

# Check for AWS access keys (AKIA...)
if echo "$DIFF" | grep -nE 'AKIA[0-9A-Z]{16}' > /dev/null; then
  ISSUES+=("AWS access key (AKIA...) found in staged changes")
fi

# Check for common secret patterns assigned to variables
# Matches: key = "sk-...", token: "abc123...", secret = 'longstring'
if echo "$DIFF" | grep -nEi '(api[_-]?key|secret|token|password|credential)\s*[:=]\s*["\x27][A-Za-z0-9+/=_-]{16,}' > /dev/null; then
  ISSUES+=("Possible hardcoded secret (API key, token, or password) found in staged changes")
fi

# Check for Anthropic API keys
if echo "$DIFF" | grep -nE 'sk-ant-[a-zA-Z0-9_-]{20,}' > /dev/null; then
  ISSUES+=("Anthropic API key (sk-ant-...) found in staged changes")
fi

# Check for Postmark API keys (UUID format assigned to a key/token variable)
if echo "$DIFF" | grep -nEi '(postmark|smtp)\s*[:=]' > /dev/null; then
  ISSUES+=("Possible Postmark credential found in staged changes")
fi

# Check for Kroger credentials
if echo "$DIFF" | grep -nEi 'kroger.*(client|secret|key)\s*[:=]\s*["\x27]' > /dev/null; then
  ISSUES+=("Possible Kroger credential found in staged changes")
fi

# Check for USDA API keys
if echo "$DIFF" | grep -nEi 'usda.*(key|token)\s*[:=]\s*["\x27]' > /dev/null; then
  ISSUES+=("Possible USDA API key found in staged changes")
fi

if [ ${#ISSUES[@]} -gt 0 ]; then
  echo "BLOCKED: Potential secrets detected in staged changes:" >&2
  for issue in "${ISSUES[@]}"; do
    echo "  - $issue" >&2
  done
  echo "" >&2
  echo "Move secrets to environment variables or AWS Secrets Manager." >&2
  echo "If this is a false positive, unstage the file and commit manually." >&2
  exit 2
fi

exit 0
