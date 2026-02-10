#!/bin/bash
# Claude Code status line for cld sessions
# Displays model, git info, context usage, cost, and duration.
# Receives JSON session data on stdin from Claude Code.
#
# Requires: jq (https://jqlang.github.io/jq/)

# Bail with a plain fallback if jq is missing
if ! command -v jq &>/dev/null; then
  echo "[statusline] jq not found"
  exit 0
fi

input=$(cat)

# --- Extract fields (null-safe) ---
MODEL=$(echo "$input" | jq -r '.model.display_name // "?"')
DIR=$(echo "$input" | jq -r '.workspace.current_dir // ""')
DIR_NAME="${DIR##*/}"
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
DURATION_MS=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')
LINES_ADDED=$(echo "$input" | jq -r '.cost.total_lines_added // 0')
LINES_REMOVED=$(echo "$input" | jq -r '.cost.total_lines_removed // 0')

# Ensure PCT is a valid integer
PCT=${PCT:-0}
[[ "$PCT" =~ ^[0-9]+$ ]] || PCT=0

# --- Colors ---
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
DIM='\033[2m'
RESET='\033[0m'

# --- Git info (cached for performance) ---
# Cache keyed by project dir hash to avoid collisions between sessions
CACHE_KEY=$(echo "$DIR" | md5sum 2>/dev/null | cut -d' ' -f1 || echo "$DIR" | md5 2>/dev/null | cut -d' ' -f1 || echo "default")
CACHE_FILE="/tmp/statusline-git-${CACHE_KEY}"
CACHE_MAX_AGE=5

cache_is_stale() {
  [ ! -f "$CACHE_FILE" ] || \
  [ $(($(date +%s) - $(stat -f %m "$CACHE_FILE" 2>/dev/null || stat -c %Y "$CACHE_FILE" 2>/dev/null || echo 0))) -gt $CACHE_MAX_AGE ]
}

if cache_is_stale; then
  if [ -n "$DIR" ] && cd "$DIR" 2>/dev/null && git rev-parse --git-dir &>/dev/null; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "")
    # Truncate long branch names
    if [ ${#BRANCH} -gt 20 ]; then
      BRANCH="${BRANCH:0:17}..."
    fi
    STAGED=$(git diff --cached --numstat 2>/dev/null | wc -l | tr -d ' ')
    MODIFIED=$(git diff --numstat 2>/dev/null | wc -l | tr -d ' ')
    echo "${BRANCH}|${STAGED}|${MODIFIED}" > "$CACHE_FILE"
  else
    echo "||" > "$CACHE_FILE"
  fi
fi

IFS='|' read -r BRANCH STAGED MODIFIED < "$CACHE_FILE"

# --- Line 1: Model, project, git ---
LINE1="${CYAN}[${MODEL}]${RESET} ${DIR_NAME}"

if [ -n "$BRANCH" ]; then
  GIT_INFO=" | ${DIM}${BRANCH}${RESET}"
  [ "${STAGED:-0}" -gt 0 ] && GIT_INFO="${GIT_INFO} ${GREEN}+${STAGED}${RESET}"
  [ "${MODIFIED:-0}" -gt 0 ] && GIT_INFO="${GIT_INFO} ${YELLOW}~${MODIFIED}${RESET}"
  LINE1="${LINE1}${GIT_INFO}"
fi

# --- Line 2: Context bar, cost, duration, lines ---
# Color the bar based on usage thresholds
if [ "$PCT" -ge 90 ]; then
  BAR_COLOR="$RED"
elif [ "$PCT" -ge 70 ]; then
  BAR_COLOR="$YELLOW"
else
  BAR_COLOR="$GREEN"
fi

BAR_WIDTH=10
FILLED=$((PCT * BAR_WIDTH / 100))
EMPTY=$((BAR_WIDTH - FILLED))
BAR=""
[ "$FILLED" -gt 0 ] && BAR=$(printf "%${FILLED}s" | tr ' ' '█')
[ "$EMPTY" -gt 0 ] && BAR="${BAR}$(printf "%${EMPTY}s" | tr ' ' '░')"

COST_FMT=$(printf '$%.2f' "$COST")

DURATION_SEC=$((DURATION_MS / 1000))
MINS=$((DURATION_SEC / 60))
SECS=$((DURATION_SEC % 60))

LINE2="${BAR_COLOR}${BAR}${RESET} ${PCT}%"
LINE2="${LINE2} | ${YELLOW}${COST_FMT}${RESET}"
LINE2="${LINE2} | ${DIM}${MINS}m ${SECS}s${RESET}"

# Only show lines changed if there are any
if [ "${LINES_ADDED:-0}" -gt 0 ] || [ "${LINES_REMOVED:-0}" -gt 0 ]; then
  LINE2="${LINE2} | ${GREEN}+${LINES_ADDED}${RESET}/${RED}-${LINES_REMOVED}${RESET}"
fi

echo -e "$LINE1"
echo -e "$LINE2"
