#!/bin/bash
# Rebuild and restart claude-bridge web server
# Usage: ./restart.sh

set -e
cd "$(dirname "$0")"

echo "==> Killing processes on port 3100..."
lsof -ti:3100 | xargs kill -9 2>/dev/null || true

# Wait and retry until port is actually free
for i in 1 2 3 4 5; do
  sleep 1
  if ! lsof -ti:3100 >/dev/null 2>&1; then
    echo "==> Port 3100 is free"
    break
  fi
  echo "    Port still in use, killing again (attempt $i)..."
  lsof -ti:3100 | xargs kill -9 2>/dev/null || true
done

# Final check
if lsof -ti:3100 >/dev/null 2>&1; then
  echo "ERROR: Could not free port 3100. PIDs still holding it:"
  lsof -i:3100
  exit 1
fi

echo "==> Clean building..."
rm -rf .next
npm run build

echo "==> Starting server..."
NODE_ENV=production nohup node dist/server.cjs > /tmp/claude-bridge.log 2>&1 &
SERVER_PID=$!

sleep 2
if curl -s -o /dev/null -w '' http://localhost:3100; then
  echo "==> Server running (PID $SERVER_PID)"
  echo "    Logs: /tmp/claude-bridge.log"
else
  echo "ERROR: Server failed to start. Check /tmp/claude-bridge.log"
  cat /tmp/claude-bridge.log
  exit 1
fi
