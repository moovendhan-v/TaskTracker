#!/usr/bin/env bash
# Launch an isolated Chrome profile for REA browser observation.
# DevTools listens on loopback only. See docs/research/REA_RESEARCH_PROTOCOL.md
# and complete its gate (terms check + user approval) before using this.
set -euo pipefail

URL="${1:-about:blank}"
PORT="${REA_CDP_PORT:-9222}"
PROFILE="${REA_BROWSER_PROFILE:-$HOME/.rea-browser-profile}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [[ ! -x "$CHROME" ]]; then
  echo "Google Chrome not found at $CHROME" >&2
  exit 1
fi

mkdir -p "$PROFILE"
echo "Chrome profile: $PROFILE"
echo "CDP endpoint:   http://127.0.0.1:$PORT"

exec "$CHROME" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  "$URL"
