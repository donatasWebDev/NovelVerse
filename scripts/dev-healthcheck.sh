#!/usr/bin/env bash
# NovelVerse — smoke-check local dev services after startup or P0 fixes
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:5000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
TIMEOUT="${TIMEOUT:-30}"
MAX_RETRIES="${HEALTH_RETRIES:-10}"
RETRY_DELAY="${HEALTH_RETRY_DELAY:-3}"

wait_for_backend() {
  echo "  Waiting for backend (up to $((MAX_RETRIES * RETRY_DELAY))s)..."
  local i
  for ((i=1; i<=MAX_RETRIES; i++)); do
    if curl -sf --max-time 5 "$BACKEND_URL/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$RETRY_DELAY"
  done
  return 1
}

pass=0
fail=0

check() {
  local name="$1"
  local url="$2"
  local expect="${3:-}"

  printf "  %-22s " "$name"

  if response=$(curl -sf --max-time "$TIMEOUT" "$url" 2>/dev/null); then
    if [[ -n "$expect" ]] && ! echo "$response" | grep -q "$expect"; then
      echo "FAIL (unexpected response)"
      fail=$((fail + 1))
      return
    fi
    echo "OK"
    pass=$((pass + 1))
  else
    echo "FAIL (unreachable)"
    fail=$((fail + 1))
  fi
}

echo "=== NovelVerse Health Check ==="
echo "  Backend:  $BACKEND_URL"
echo "  Frontend: $FRONTEND_URL"
echo ""

if ! wait_for_backend; then
  echo "  Backend never became ready"
  exit 1
fi

check "Backend /health" "$BACKEND_URL/health" '"status"'
check "Frontend (Vite)" "$FRONTEND_URL" ""
# User route requires auth — 401 still means the server is up
if curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$BACKEND_URL/api/user/" | grep -qE '^(401|403|200)$'; then
  printf "  %-22s OK\n" "Backend API /user"
  pass=$((pass + 1))
else
  printf "  %-22s FAIL\n" "Backend API /user"
  fail=$((fail + 1))
fi

echo ""
echo "Result: $pass passed, $fail failed"

if [[ "$fail" -gt 0 ]]; then
  exit 1
fi