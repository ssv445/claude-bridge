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

# Verify server is actually healthy (HTTP 200 from sessions API)
for i in 1 2 3 4 5; do
  sleep 2
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/api/sessions 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "==> Server running (PID $SERVER_PID)"
    echo "    Logs: /tmp/claude-bridge.log"
    exit 0
  fi
  echo "    Waiting for server... (attempt $i, got HTTP $HTTP_CODE)"
done

echo "ERROR: Server failed to start. Check /tmp/claude-bridge.log"
tail -20 /tmp/claude-bridge.log
exit 1
